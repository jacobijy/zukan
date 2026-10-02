"""Configuration and rsync command helpers for remote-debug artifact syncing."""

from __future__ import annotations

from collections.abc import Sequence
import os
import shlex
import shutil
import subprocess
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
OUT_FORMAT = "[%t] mtime=%M size=%l transferred=%b change=%i path=%n%L"


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
    target_key = target.replace("-", "_").upper()
    return {
        "remote": env.get("REMOTE") or config.get("REMOTE") or "jacobi@192.168.100.100",
        "remote_dir": (
            env.get("REMOTE_DIR")
            or config.get(f"{target_key}_REMOTE_DIR")
            or config.get("REMOTE_DIR")
            or TARGET_DEFAULTS[target]["remote_dir"]
        ),
        "local_dir": (
            env.get("LOCAL_DIR")
            or config.get(f"{target_key}_LOCAL_DIR")
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
        "--itemize-changes",
        f"--out-format={OUT_FORMAT}",
        "--human-readable",
        "--stats",
    ]
    if mirror:
        command.append("--delete")
    for pattern in exclude_patterns:
        command.extend(["--exclude", pattern])
    command.extend(["-e", remote_shell, source, f"{local_dir}/"])
    return command


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
    result = subprocess.run(command, check=False, stdout=subprocess.PIPE, text=True)
    if result.returncode:
        if result.stdout:
            print(result.stdout, end="")
        raise subprocess.CalledProcessError(result.returncode, command)

    if any("change=" in line for line in result.stdout.splitlines()):
        print(f"从 {target_cfg['remote']}:{target_cfg['remote_dir']}")
        print(f"  → {local_dir}")
        print("文件输出格式：[同步时间] mtime=远端修改时间 size=文件大小 transferred=传输字节 change=变更 path=路径")
        print(result.stdout, end="")
