#!/usr/bin/env python3
"""Synchronize remote-debug artifacts using rsync over SSH."""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

from remote_sync import (
    TARGET_DEFAULTS,
    ChangeEntry,
    get_target_config,
    load_config,
    resolve_local_path,
    run_rsync,
    settle_sync,
)


def parse_args() -> argparse.Namespace:
    class HelpOnErrorParser(argparse.ArgumentParser):
        def error(self, message: str) -> None:
            self.print_help(sys.stderr)
            self.exit(2, f"{self.prog}: error: {message}\n")

    parser = HelpOnErrorParser(
        description="通过 SSH/rsync 将 Linux 上的远程调试产物同步到本机。",
        epilog=(
            "配置优先级：命令行参数 > 环境变量 > pull.conf.local > pull.conf > 内置默认值。"
            "常驻同步可按 Ctrl+C 停止。"
        ),
    )
    parser.add_argument(
        "--target",
        choices=sorted(TARGET_DEFAULTS),
        required=True,
        help="同步目标：mp-weixin 或 app。",
    )
    parser.add_argument("--remote", help="远程 SSH 主机，格式为 user@host。")
    parser.add_argument("--remote-dir", help="Linux 上的源目录。")
    parser.add_argument("--local-dir", help="本机接收目录，支持 ~ 和 $HOME。")
    parser.add_argument("--interval", help="常驻同步的轮询间隔秒数（默认：1）。")
    parser.add_argument("--ssh-key", help="SSH 私钥路径；不指定时使用 SSH agent 或默认密钥。")
    parser.add_argument("--ssh-port", help="SSH 端口（默认：22）。")
    parser.add_argument("--ssh-cmd", help="SSH 命令（默认：ssh）。")
    parser.add_argument("--once", action="store_true", help="只同步一次后退出。")
    parser.add_argument("--dry-run", action="store_true", help="显示最终配置，不连接远程主机。")
    return parser.parse_args()


def sync_once(target_cfg: dict[str, str]) -> None:
    local_dir = resolve_local_path(target_cfg["local_dir"])
    run_rsync(target_cfg, local_dir)


def main() -> int:
    args = parse_args()
    target_cfg = get_target_config(args.target, load_config(), dict(os.environ))
    for arg_name, config_name in (
        ("remote", "remote"),
        ("remote_dir", "remote_dir"),
        ("local_dir", "local_dir"),
        ("interval", "interval"),
        ("ssh_key", "ssh_key"),
        ("ssh_port", "ssh_port"),
        ("ssh_cmd", "ssh_cmd"),
    ):
        value = getattr(args, arg_name)
        if value is not None:
            target_cfg[config_name] = value

    target_cfg["local_dir"] = str(resolve_local_path(target_cfg["local_dir"]))
    if args.dry_run:
        print(f"target={args.target}")
        for key in ("remote", "remote_dir", "local_dir", "interval", "ssh_key", "ssh_port", "ssh_cmd"):
            print(f"{key}={target_cfg[key]}")
        return 0

    try:
        if args.once:
            sync_once(target_cfg)
            return 0
        interval = float(target_cfg["interval"])
        if interval <= 0:
            raise ValueError("INTERVAL 必须大于 0")
        # 上一轮 dry-run 扫描到的候选变更；连续两轮一致才真正同步，
        # 跳过 watch 重编译“清空 → 重建”的中间态。
        pending: list[ChangeEntry] | None = None
        while True:
            try:
                local_dir = resolve_local_path(target_cfg["local_dir"])
                pending, _applied = settle_sync(target_cfg, local_dir, pending)
            except Exception as exc:
                print(f"同步失败：{exc}；{interval:g}s 后重试", file=sys.stderr)
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n已停止同步。")
        return 0
    except Exception as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
