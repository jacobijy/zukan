"""Configuration and rsync command helpers for remote-debug artifact syncing."""

from __future__ import annotations

from collections.abc import Sequence
import os
import shlex
import shutil
import subprocess
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


def build_rsync_command(
    target_cfg: dict[str, str],
    local_dir: Path,
    *,
    mirror: bool = True,
    exclude_patterns: Sequence[str] = (),
) -> list[str]:
    ssh_parts = shlex.split(target_cfg.get("ssh_cmd", "ssh"))
    if not ssh_parts:
        raise ValueError("SSH_CMD 不能为空")
    if target_cfg.get("ssh_port", "22") != "22":
        ssh_parts.extend(["-p", target_cfg["ssh_port"]])
    ssh_key = target_cfg.get("ssh_key", "")
    if ssh_key:
        ssh_parts.extend(["-i", str(resolve_local_path(ssh_key))])
    remote_shell = " ".join(shlex.quote(part) for part in ssh_parts)

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


def run_rsync(
    target_cfg: dict[str, str],
    local_dir: Path,
    *,
    mirror: bool = True,
    exclude_patterns: Sequence[str] = (),
) -> None:
    if shutil.which("rsync") is None:
        raise FileNotFoundError("找不到 rsync，请安装 rsync 并确保其位于 PATH 中")
    command = build_rsync_command(
        target_cfg,
        local_dir,
        mirror=mirror,
        exclude_patterns=exclude_patterns,
    )
    started_at = datetime.now()
    result = subprocess.run(command, check=False, stdout=subprocess.PIPE, text=True)
    finished_at = datetime.now()
    if result.returncode:
        if result.stdout:
            print(result.stdout, end="")
        raise subprocess.CalledProcessError(result.returncode, command)

    entries: list[ChangeEntry] = []
    for line in result.stdout.splitlines():
        if not line.startswith(LINE_PREFIX):
            continue
        fields = line.split("\t")
        itemize = fields[1].strip()
        if not itemize or itemize[0] == ".":
            # Y=. 表示文件未传输（仅权限/时间戳等属性差异），不算变更。
            continue
        size = int(fields[3]) if len(fields) > 3 and fields[3].isdigit() else 0
        entries.append(ChangeEntry(classify_change(itemize), fields[2], size))

    if entries:
        render_changes(entries, target_cfg, local_dir, started_at, finished_at)
