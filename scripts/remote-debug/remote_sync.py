"""Configuration and rsync command helpers for remote-debug artifact syncing."""

from __future__ import annotations

from collections.abc import Sequence
import hashlib
import os
import shlex
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_CANDIDATES = ("pull.conf", "pull.conf.local")
TARGET_DEFAULTS = {
    "mp-weixin": {
        "remote_dir": "~/Code/zukan/dist/dev/mp-weixin",
        "local_dir": "$HOME/zukan-mp-weixin",
    },
    "app": {
        "remote_dir": "~/Code/zukan/dist/build/app",
        "local_dir": "$HOME/zukan-app",
    },
}
# rsync 输出机器可解析的行（前缀 + tab 分隔），由 run_rsync 解析后重排为可读日志。
# 字段：%i 变更标记 / %n 路径 / %l 文件字节 / %b rsync 实际传输字节。
OUT_FORMAT = "@@FILE\t%i\t%n\t%l\t%b"
LINE_PREFIX = "@@FILE\t"


def parse_config(path: Path) -> dict[str, str]:
    config: dict[str, str] = {}
    if not path.exists():
        return config

    with path.open("r", encoding="utf-8") as config_file:
        for raw_line in config_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()
            quote = ""
            for index, char in enumerate(value):
                if char in {"'", '"'}:
                    if not quote:
                        quote = char
                    elif quote == char:
                        quote = ""
                elif not quote and value.startswith("  #", index):
                    value = value[:index].rstrip()
                    break
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            config[key] = value
    return config


def load_config() -> dict[str, str]:
    merged: dict[str, str] = {}
    for candidate in CONFIG_CANDIDATES:
        merged.update(parse_config(SCRIPT_DIR / candidate))
    return merged


def resolve_local_path(value: str) -> Path:
    value = value.replace("$HOME", str(Path.home()))
    return Path(os.path.expandvars(os.path.expanduser(value))).resolve()


def get_target_config(target: str, config: dict[str, str], env: dict[str, str]) -> dict[str, str]:
    target_keys = ("MP", "MP_WEIXIN") if target == "mp-weixin" else ("APP",)
    return {
        "remote": env.get("REMOTE") or config.get("REMOTE") or "jacobi@192.168.100.100",
        "remote_dir": (
            env.get("REMOTE_DIR")
            or next((config[f"{key}_REMOTE_DIR"] for key in target_keys if f"{key}_REMOTE_DIR" in config), None)
            or config.get("REMOTE_DIR")
            or TARGET_DEFAULTS[target]["remote_dir"]
        ),
        "local_dir": (
            env.get("LOCAL_DIR")
            or next((config[f"{key}_LOCAL_DIR"] for key in target_keys if f"{key}_LOCAL_DIR" in config), None)
            or config.get("LOCAL_DIR")
            or TARGET_DEFAULTS[target]["local_dir"]
        ),
        "interval": env.get("INTERVAL") or config.get("INTERVAL") or "1",
        "ssh_key": env.get("SSH_KEY") or config.get("SSH_KEY") or "",
        "ssh_port": env.get("SSH_PORT") or config.get("SSH_PORT") or "22",
        "ssh_cmd": env.get("SSH_CMD") or config.get("SSH_CMD") or "ssh",
    }


def _ssh_args(target_cfg: dict[str, str]) -> list[str]:
    """ssh 命令 + 端口/密钥参数（rsync、sftp、远端清单共用）。"""
    parts = shlex.split(target_cfg.get("ssh_cmd", "ssh"))
    if not parts:
        raise ValueError("SSH_CMD 不能为空")
    if target_cfg.get("ssh_port", "22") != "22":
        parts.extend(["-p", target_cfg["ssh_port"]])
    ssh_key = target_cfg.get("ssh_key", "")
    if ssh_key:
        parts.extend(["-i", str(resolve_local_path(ssh_key))])
    return parts


def build_rsync_command(
    target_cfg: dict[str, str],
    local_dir: Path,
    *,
    mirror: bool = True,
    exclude_patterns: Sequence[str] = (),
    dry_run: bool = False,
) -> list[str]:
    remote_shell = " ".join(shlex.quote(part) for part in _ssh_args(target_cfg))

    remote_dir = target_cfg["remote_dir"].rstrip("/")
    source = f"{target_cfg['remote']}:{remote_dir}/"
    command = [
        "rsync",
        "-az",
        # 目标常是 NTFS/FAT/SMB（如 WSL 的 /mnt/d），保留不了 Linux 权限位；
        # 不比对/设置权限，避免每轮把全部文件当成“仅权限不同”重复列出。
        "--no-perms",
        # mp-weixin watch 每轮全量重写产物、刷新所有文件 mtime（内容没变也刷），
        # 按 mtime 判定会把整轮文件当成更新；改用内容校验和，只同步真正变化的文件。
        "--checksum",
        "--itemize-changes",
        f"--out-format={OUT_FORMAT}",
    ]
    if dry_run:
        # 只扫描出变更清单、不落盘；用于编译稳定检测。
        command.append("--dry-run")
    if mirror:
        command.append("--delete")
    for pattern in exclude_patterns:
        command.extend(["--exclude", pattern])
    command.extend(["-e", remote_shell, source, f"{local_dir}/"])
    return command


@dataclass
class ChangeEntry:
    """一次真实的文件变更（不含仅属性/时间戳差异）。"""

    kind: str  # "create" | "update" | "delete"
    path: str
    size: int


def classify_change(itemize: str) -> str:
    """把 rsync 的 %i 标记归类为 create / update / delete。"""
    head = itemize[0]
    if head == "*":  # *deleting
        return "delete"
    if head in {"c", "h"}:  # 本地创建（如新目录）/ 硬链接
        return "create"
    if head == ">" and set(itemize[2:]) <= {"+"}:  # >f+++++++++ 全新文件
        return "create"
    return "update"


def human_size(num_bytes: int) -> str:
    """把字节数格式化为紧凑的人类可读单位。"""
    value = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            return f"{int(value)} {unit}" if unit == "B" else f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} GB"


KIND_LABEL = {"create": "新增", "update": "更新", "delete": "删除"}


def render_changes(
    entries: list[ChangeEntry],
    target_cfg: dict[str, str],
    local_dir: Path,
    started_at: datetime,
    finished_at: datetime,
) -> None:
    print(f"[{started_at.strftime('%Y-%m-%d %H:%M:%S')}] {target_cfg['remote']}:{target_cfg['remote_dir']} → {local_dir}")
    for entry in entries:
        if entry.kind == "delete" or entry.path.endswith("/"):
            size_col = "-"  # 删除无大小；目录大小是块字节、无意义，靠结尾 / 标识
        else:
            size_col = human_size(entry.size)
        print(f"  {KIND_LABEL[entry.kind]}  {size_col.rjust(9)}  {entry.path}")

    creates = [e for e in entries if e.kind == "create"]
    updates = [e for e in entries if e.kind == "update"]
    deletes = [e for e in entries if e.kind == "delete"]
    dirs = sum(1 for e in creates if e.path.endswith("/"))
    total = sum(e.size for e in entries if e.kind != "delete" and not e.path.endswith("/"))

    parts: list[str] = []
    if creates:
        segment = f"新增 {len(creates)}"
        if dirs:
            segment += f"（文件 {len(creates) - dirs}、目录 {dirs}）"
        parts.append(segment)
    if updates:
        parts.append(f"更新 {len(updates)}")
    if deletes:
        parts.append(f"删除 {len(deletes)}")
    parts.append(f"合计 {human_size(total)}")
    elapsed = (finished_at - started_at).total_seconds()
    print(
        f"  共 {len(entries)} 项 · "
        + " · ".join(parts)
        + f" · 完成 {finished_at.strftime('%H:%M:%S')}（耗时 {elapsed:.2f}s）"
    )


def parse_itemize(stdout: str) -> list[ChangeEntry]:
    """从 rsync 输出里解析真实变更（Y=. 的纯属性差异行丢弃）。"""
    entries: list[ChangeEntry] = []
    for line in stdout.splitlines():
        if not line.startswith(LINE_PREFIX):
            continue
        fields = line.split("\t")
        itemize = fields[1].strip()
        if not itemize or itemize[0] == ".":
            # Y=. 表示文件未传输（仅权限/时间戳等属性差异），不算变更。
            continue
        size = int(fields[3]) if len(fields) > 3 and fields[3].isdigit() else 0
        entries.append(ChangeEntry(classify_change(itemize), fields[2], size))
    return entries


def change_signature(entries: Sequence[ChangeEntry]) -> tuple[tuple[str, str, int], ...]:
    """变更清单的内容指纹：动作 + 路径 + 大小，与行序无关。

    连续两轮扫描指纹相同，才认为重编译已经落定、中间态结束。
    """
    return tuple(sorted((entry.kind, entry.path, entry.size) for entry in entries))


def _execute_rsync(command: Sequence[str]) -> tuple[datetime, datetime, str]:
    started_at = datetime.now()
    result = subprocess.run(list(command), check=False, stdout=subprocess.PIPE, text=True)
    finished_at = datetime.now()
    if result.returncode:
        if result.stdout:
            print(result.stdout, end="")
        raise subprocess.CalledProcessError(result.returncode, command)
    return started_at, finished_at, result.stdout


def run_rsync(
    target_cfg: dict[str, str],
    local_dir: Path,
    *,
    mirror: bool = True,
    exclude_patterns: Sequence[str] = (),
) -> None:
    """执行一轮真实同步（--once 用）：变更非空才打印。"""
    if shutil.which("rsync") is None:
        raise FileNotFoundError("找不到 rsync，请安装 rsync 并确保其位于 PATH 中")
    command = build_rsync_command(
        target_cfg,
        local_dir,
        mirror=mirror,
        exclude_patterns=exclude_patterns,
    )
    started_at, finished_at, stdout = _execute_rsync(command)
    entries = parse_itemize(stdout)
    if entries:
        render_changes(entries, target_cfg, local_dir, started_at, finished_at)


def settle_sync(
    target_cfg: dict[str, str],
    local_dir: Path,
    pending: Sequence[ChangeEntry] | None,
    *,
    mirror: bool = True,
    exclude_patterns: Sequence[str] = (),
) -> tuple[list[ChangeEntry] | None, bool]:
    """带编译稳定检测的一轮轮询。

    watch 重编译会先清空 static 等目录再重新生成，单轮轮询可能抓到“删除/重建”
    中间态。这里每轮只跑 --dry-run 扫描：扫描为空说明本机已是最新；与上一轮
    指纹不一致说明编译仍在进行，只记下候选、不落盘；连续两轮指纹一致才执行
    真正的 rsync。

    返回 (新的 pending, 本轮是否执行了同步)。
    """
    if shutil.which("rsync") is None:
        raise FileNotFoundError("找不到 rsync，请安装 rsync 并确保其位于 PATH 中")
    plan_command = build_rsync_command(
        target_cfg,
        local_dir,
        mirror=mirror,
        exclude_patterns=exclude_patterns,
        dry_run=True,
    )
    _, _, stdout = _execute_rsync(plan_command)
    plan = parse_itemize(stdout)
    if not plan:
        # 中间态已自行收敛（清空后又生成了内容相同的文件），从未落盘，无需同步。
        return None, False
    if pending is not None and change_signature(pending) == change_signature(plan):
        command = build_rsync_command(
            target_cfg,
            local_dir,
            mirror=mirror,
            exclude_patterns=exclude_patterns,
        )
        started_at, finished_at, _ = _execute_rsync(command)
        render_changes(plan, target_cfg, local_dir, started_at, finished_at)
        return None, True
    return plan, False


# SSH_CMD 里可原样透传给 sftp 的选项（均需带一个值）。
_SFTP_VALUE_OPTS = {"-o", "-i", "-F", "-J", "-l", "-c", "-m", "-O"}


def _quote_sftp_path(value: str) -> str:
    """sftp 批处理按空格切分参数，含空格的路径用双引号包起来。"""
    if any(char in value for char in " \t"):
        return '"' + value.replace('"', '""') + '"'
    return value


def build_sftp_command(target_cfg: dict[str, str]) -> list[str]:
    """构造 sftp 命令（-b - 表示批处理指令从 stdin 读入）。"""
    args = ["sftp", "-b", "-"]
    options = _ssh_args(target_cfg)[1:]
    index = 0
    while index < len(options):
        option = options[index]
        if option == "-p" and index + 1 < len(options):
            # ssh 用小写 -p 指定端口，sftp 是大写 -P。
            args.extend(["-P", options[index + 1]])
            index += 2
            continue
        if option in _SFTP_VALUE_OPTS and index + 1 < len(options):
            args.extend([option, options[index + 1]])
            index += 2
            continue
        args.append(option)
        index += 1

    args.append(target_cfg["remote"])
    return args


def _sftp_remote_path(remote_dir: str) -> str:
    """把配置里的远端目录转成 sftp 批处理能用的路径。

    sftp 的 cd/get 不展开 `~`（会被当成相对路径），而 sftp 会话启动时就在远端
    家目录，所以 `~/x` 直接写成相对路径 `x`；`~user/` 无法可靠还原，直接报错。
    """
    path = remote_dir.rstrip("/")
    if path in ("", "~"):
        return ""  # 已在远端家目录，无需 cd
    if path.startswith("~/"):
        return path[2:]
    if path.startswith("~"):
        raise ValueError(f"sftp 不支持 ~user/ 形式的远端路径，请改用绝对路径：{path}")
    return path


def build_sftp_batch(remote_dir: str, local_dir: Path, filenames: Sequence[str]) -> str:
    """生成 sftp 批处理指令：切到远端脚本目录，逐个取回指定的固定文件。"""
    local_posix = str(local_dir).replace("\\", "/")  # Windows 路径给 sftp 用正斜杠
    lines: list[str] = []
    remote_path = _sftp_remote_path(remote_dir)
    if remote_path:
        lines.append(f"cd {_quote_sftp_path(remote_path)}")
    lines.append(f"lcd {_quote_sftp_path(local_posix)}")
    lines.extend(f"get {_quote_sftp_path(name)}" for name in filenames)
    return "\n".join(lines) + "\n"


def _run_sftp_batch(target_cfg: dict[str, str], batch: str) -> None:
    """执行一段 sftp 批处理；出错时带出 sftp 自己的报错。"""
    if shutil.which("sftp") is None:
        raise FileNotFoundError("找不到 sftp，请安装 OpenSSH 客户端并确保其位于 PATH 中")
    command = build_sftp_command(target_cfg)
    result = subprocess.run(
        command,
        input=batch,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode:
        detail = "\n".join(part.strip() for part in (result.stderr, result.stdout) if part.strip())
        # sftp 批处理遇错即中止，但不说是哪一步；把远端目录一并带出。
        raise RuntimeError(
            f"sftp 退出码 {result.returncode}（远端目录 {target_cfg['remote_dir']}）；"
            + (f"报错：{detail}" if detail else "请确认该目录及文件存在、密钥可用")
        )


def run_sftp_fetch(
    target_cfg: dict[str, str],
    local_dir: Path,
    filenames: Sequence[str],
) -> None:
    """用 sftp 取回固定文件列表（脚本目录自举用，不依赖 rsync）。"""
    _run_sftp_batch(target_cfg, build_sftp_batch(target_cfg["remote_dir"], local_dir, filenames))


MANIFEST_MARKER = "--HASH--"


def _shell_remote_path(path: str) -> str:
    """给远端 shell 的路径：保留 ~ 前缀让其展开，其余部分安全引用。"""
    if path.startswith("~"):
        head, separator, tail = path.partition("/")
        return head + (separator + shlex.quote(tail) if separator else "")
    return shlex.quote(path)


def build_remote_manifest_command(target_cfg: dict[str, str]) -> list[str]:
    """通过 ssh 在远端生成「文件大小 + 内容 MD5」清单。"""
    remote_dir = target_cfg["remote_dir"].rstrip("/") or "."
    script = (
        f"cd {_shell_remote_path(remote_dir)} && "
        "find . -type f -printf '%s\\t%p\\n' && "
        f"echo {MANIFEST_MARKER} && "
        "find . -type f -exec md5sum {} +"
    )
    return _ssh_args(target_cfg) + [target_cfg["remote"], script]


def _manifest_path(path: str) -> str:
    return path[2:] if path.startswith("./") else path


def parse_remote_manifest(stdout: str) -> dict[str, tuple[int, str]]:
    """解析 build_remote_manifest_command 的输出为 {相对路径: (大小, md5)}。"""
    sizes: dict[str, int] = {}
    hashes: dict[str, tuple[int, str]] = {}
    reading_hashes = False
    for line in stdout.splitlines():
        if line.strip() == MANIFEST_MARKER:
            reading_hashes = True
            continue
        if reading_hashes:
            digest, path = line[:32], line[32:].strip()
            if len(digest) == 32 and path:
                hashes[_manifest_path(path)] = (0, digest)
            continue
        size, separator, path = line.partition("\t")
        if separator and size.isdigit():
            sizes[_manifest_path(path)] = int(size)
    manifest: dict[str, tuple[int, str]] = {}
    for path, (_, digest) in hashes.items():
        manifest[path] = (sizes.get(path, 0), digest)
    return manifest


def fetch_remote_manifest(target_cfg: dict[str, str]) -> dict[str, tuple[int, str]]:
    command = build_remote_manifest_command(target_cfg)
    result = subprocess.run(
        command, check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    if result.returncode:
        detail = "\n".join(part.strip() for part in (result.stderr, result.stdout) if part.strip())
        raise RuntimeError(
            f"读取远端文件清单失败（远端目录 {target_cfg['remote_dir']}，ssh 退出码 {result.returncode}）；"
            + (f"报错：{detail}" if detail else "请确认 ssh 可用、目录存在")
        )
    return parse_remote_manifest(result.stdout)


# 本地文件哈希缓存：键含 size + mtime，稳定文件不必每轮重算。
_LOCAL_HASH_CACHE: dict[tuple[str, int, int], str] = {}


def _hash_file(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def local_manifest(local_dir: Path) -> dict[str, tuple[int, str]]:
    """扫描本地目录，得到 {相对路径: (大小, md5)}。"""
    manifest: dict[str, tuple[int, str]] = {}
    if not local_dir.exists():
        return manifest
    for dirpath, _dirnames, filenames in os.walk(local_dir):
        for name in filenames:
            full = Path(dirpath) / name
            try:
                stat = full.stat()
            except OSError:
                continue
            relative = full.relative_to(local_dir).as_posix()
            key = (str(full), stat.st_size, stat.st_mtime_ns)
            digest = _LOCAL_HASH_CACHE.get(key)
            if digest is None:
                try:
                    digest = _hash_file(full)
                except OSError:
                    continue
                if len(_LOCAL_HASH_CACHE) > 10000:
                    _LOCAL_HASH_CACHE.clear()
                _LOCAL_HASH_CACHE[key] = digest
            manifest[relative] = (stat.st_size, digest)
    return manifest


def plan_sftp_changes(
    remote: dict[str, tuple[int, str]],
    local: dict[str, tuple[int, str]],
    *,
    mirror: bool = True,
) -> list[ChangeEntry]:
    """按内容哈希比较远端与本地，得出需要下载/删除的文件。"""
    entries: list[ChangeEntry] = []
    for path in sorted(remote):
        size, digest = remote[path]
        if path not in local:
            entries.append(ChangeEntry("create", path, size))
        elif local[path][1] != digest:
            entries.append(ChangeEntry("update", path, size))
    if mirror:
        entries.extend(ChangeEntry("delete", path, 0) for path in sorted(local) if path not in remote)
    return entries


def _prune_empty_dirs(local_dir: Path) -> None:
    for dirpath, _dirnames, _filenames in os.walk(local_dir, topdown=False):
        path = Path(dirpath)
        if path == local_dir:
            continue
        try:
            path.rmdir()
        except OSError:
            pass


def apply_sftp_changes(
    target_cfg: dict[str, str],
    local_dir: Path,
    entries: Sequence[ChangeEntry],
) -> tuple[datetime, datetime]:
    """下载变更文件并删除多余文件，返回本轮起止时间。"""
    started_at = datetime.now()
    downloads = [entry for entry in entries if entry.kind != "delete"]
    if downloads:
        local_posix = str(local_dir).replace("\\", "/")
        lines: list[str] = []
        remote_path = _sftp_remote_path(target_cfg["remote_dir"])
        if remote_path:
            lines.append(f"cd {_quote_sftp_path(remote_path)}")
        lines.append(f"lcd {_quote_sftp_path(local_posix)}")
        for entry in downloads:
            target = local_dir / entry.path
            target.parent.mkdir(parents=True, exist_ok=True)
            lines.append(
                f"get {_quote_sftp_path(entry.path)} {_quote_sftp_path(target.as_posix())}"
            )
        _run_sftp_batch(target_cfg, "\n".join(lines) + "\n")

    for entry in entries:
        if entry.kind != "delete":
            continue
        try:
            (local_dir / entry.path).unlink()
        except FileNotFoundError:
            pass
    _prune_empty_dirs(local_dir)
    return started_at, datetime.now()


def run_sftp_sync(
    target_cfg: dict[str, str],
    local_dir: Path,
    *,
    mirror: bool = True,
) -> None:
    """sftp 回退模式的一次性同步（--once 用）。"""
    remote = fetch_remote_manifest(target_cfg)
    entries = plan_sftp_changes(remote, local_manifest(local_dir), mirror=mirror)
    if entries:
        started_at, finished_at = apply_sftp_changes(target_cfg, local_dir, entries)
        render_changes(entries, target_cfg, local_dir, started_at, finished_at)


def settle_sftp_sync(
    target_cfg: dict[str, str],
    local_dir: Path,
    pending: dict[str, tuple[int, str]] | None,
    *,
    mirror: bool = True,
) -> tuple[dict[str, tuple[int, str]] | None, bool]:
    """sftp 回退模式的稳定检测轮询（语义同 settle_sync，但按内容哈希比对）。"""
    current = fetch_remote_manifest(target_cfg)
    if pending is None or current != pending:
        # 首轮或远端仍在变化：只记候选，不落盘。
        return current, False
    entries = plan_sftp_changes(current, local_manifest(local_dir), mirror=mirror)
    if not entries:
        return None, False
    started_at, finished_at = apply_sftp_changes(target_cfg, local_dir, entries)
    render_changes(entries, target_cfg, local_dir, started_at, finished_at)
    return None, True
