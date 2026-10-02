#!/usr/bin/env python3
"""Fetch the remote-debug helper directory using rsync over SSH."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from remote_sync import load_config, resolve_local_path, run_rsync

CACHE_EXCLUDES = (
    "__pycache__/",
    "pull.conf",
    "pull.conf.local",
    "*.py[cod]",
    ".pytest_cache/",
    ".mypy_cache/",
    ".ruff_cache/",
    ".tox/",
    ".coverage",
    ".DS_Store",
    "Thumbs.db",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="通过 SSH/rsync 将 Linux 上的 remote-debug 辅助脚本拉取到本机。",
        epilog="拉取时会排除配置文件、缓存目录、Python 字节码和常见系统文件。",
    )
    parser.add_argument(
        "local_dir",
        nargs="?",
        default=None,
        help="本机目标目录（默认：当前目录）。",
    )
    parser.add_argument("--remote", help="远程 SSH 主机，格式为 user@host。")
    parser.add_argument("--remote-dir", help="Linux 上脚本目录的路径。")
    parser.add_argument("--ssh-key", help="SSH 私钥路径；不指定时使用 SSH agent 或默认密钥。")
    parser.add_argument("--ssh-port", help="SSH 端口（默认：22）。")
    parser.add_argument("--ssh-cmd", help="SSH 命令（默认：ssh）。")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config()
    remote = args.remote or os.environ.get("REMOTE") or config.get("REMOTE") or "jacobi@192.168.100.100"
    remote_dir = (
        args.remote_dir
        or os.environ.get("REMOTE_DIR")
        or config.get("REMOTE_SCRIPTS_DIR")
        or "~/Code/zukan/scripts/remote-debug"
    )
    local_dir = resolve_local_path(args.local_dir or os.environ.get("LOCAL_DIR") or ".")
    ssh_key = args.ssh_key or os.environ.get("SSH_KEY") or config.get("SSH_KEY", "")
    ssh_port = args.ssh_port or os.environ.get("SSH_PORT") or config.get("SSH_PORT", "22")
    ssh_cmd = args.ssh_cmd or os.environ.get("SSH_CMD") or config.get("SSH_CMD") or "ssh"

    try:
        local_dir.mkdir(parents=True, exist_ok=True)
        run_rsync(
            {
                "remote": remote,
                "remote_dir": remote_dir,
                "ssh_key": ssh_key,
                "ssh_port": ssh_port,
                "ssh_cmd": ssh_cmd,
            },
            local_dir,
            mirror=False,
            exclude_patterns=CACHE_EXCLUDES,
        )
        return 0
    except Exception as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
