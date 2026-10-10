from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from remote_sync import (
    ChangeEntry,
    build_rsync_command,
    change_signature,
    classify_change,
    get_target_config,
    human_size,
    parse_config,
    run_rsync,
    settle_sync,
)


def machine_line(itemize: str, path: str, size: int = 0, transferred: int = 0) -> str:
    """构造一行与 rsync --out-format 相同的机器可解析输出。"""
    return f"@@FILE\t{itemize}\t{path}\t{size}\t{transferred}"


class RsyncCommandTests(unittest.TestCase):
    def test_mp_weixin_uses_mp_config_keys(self) -> None:
        config = get_target_config(
            "mp-weixin",
            {
                "MP_REMOTE_DIR": "/remote/mp",
                "MP_LOCAL_DIR": "/local/mp",
            },
            {},
        )
        self.assertEqual(config["remote_dir"], "/remote/mp")
        self.assertEqual(config["local_dir"], "/local/mp")

    def test_mp_weixin_keeps_compatibility_with_expanded_config_keys(self) -> None:
        config = get_target_config(
            "mp-weixin",
            {
                "MP_WEIXIN_REMOTE_DIR": "/legacy/remote",
                "MP_WEIXIN_LOCAL_DIR": "/legacy/local",
            },
            {},
        )
        self.assertEqual(config["remote_dir"], "/legacy/remote")
        self.assertEqual(config["local_dir"], "/legacy/local")

    def test_parse_config_preserves_quoted_windows_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config_file = Path(temp_dir) / "pull.conf"
            config_file.write_text(
                r'LOCAL_DIR="C:\Users\Test User\zukan"  # local destination' + "\n",
                encoding="utf-8",
            )
            self.assertEqual(
                parse_config(config_file)["LOCAL_DIR"],
                r"C:\Users\Test User\zukan",
            )

    def test_rsync_command_emits_machine_format_without_perms(self) -> None:
        command = build_rsync_command(
            {
                "remote": "user@host",
                "remote_dir": "~/Code/zukan/dist/dev/mp-weixin",
                "ssh_cmd": "ssh",
                "ssh_port": "2222",
                "ssh_key": "",
            },
            Path("/tmp/zukan-mp"),
        )
        self.assertIn("--delete", command)
        self.assertIn("--itemize-changes", command)
        self.assertIn("--no-perms", command)
        self.assertIn("--checksum", command)
        self.assertNotIn("--stats", command)
        self.assertNotIn("--human-readable", command)
        self.assertIn("--out-format=@@FILE\t%i\t%n\t%l\t%b", command)
        self.assertIn("ssh -p 2222", command)
        self.assertEqual(command[-2], "user@host:~/Code/zukan/dist/dev/mp-weixin/")

    def test_non_mirror_rsync_does_not_delete_destination(self) -> None:
        command = build_rsync_command(
            {
                "remote": "user@host",
                "remote_dir": "~/Code/zukan/scripts/remote-debug",
                "ssh_cmd": "ssh",
                "ssh_port": "22",
                "ssh_key": "",
            },
            Path("/tmp/remote-debug"),
            mirror=False,
        )
        self.assertNotIn("--delete", command)
        self.assertNotIn("--dry-run", command)

    def test_dry_run_command_only_scans(self) -> None:
        command = build_rsync_command(
            {
                "remote": "user@host",
                "remote_dir": "/build",
                "ssh_cmd": "ssh",
                "ssh_port": "22",
                "ssh_key": "",
            },
            Path("/tmp/zukan"),
            dry_run=True,
        )
        self.assertIn("--dry-run", command)

    def test_change_signature_is_order_independent(self) -> None:
        entries_a = [
            ChangeEntry("update", "static/a.png", 100),
            ChangeEntry("delete", "static/b.png", 0),
        ]
        entries_b = [
            ChangeEntry("delete", "static/b.png", 0),
            ChangeEntry("update", "static/a.png", 100),
        ]
        self.assertEqual(change_signature(entries_a), change_signature(entries_b))
        self.assertNotEqual(
            change_signature(entries_a),
            change_signature([ChangeEntry("update", "static/a.png", 99)]),
        )

    @patch("remote_sync.shutil.which", return_value="/usr/bin/rsync")
    @patch("remote_sync.subprocess.run")
    def test_settle_sync_waits_then_applies_stable_plan(self, run, _which) -> None:
        plan = machine_line(">f.st......", "static/a.png", 100, 40)

        def runner(command, **_kwargs):
            stdout = "" if "--dry-run" not in command else plan
            return subprocess.CompletedProcess(command, 0, stdout=stdout)

        run.side_effect = runner
        cfg = {"remote": "u@h", "remote_dir": "/build", "ssh_cmd": "ssh", "ssh_port": "22"}

        output = StringIO()
        with redirect_stdout(output):
            pending, applied = settle_sync(cfg, Path("/tmp/zukan"), None)
        self.assertFalse(applied)
        self.assertEqual(len(pending), 1)  # 首轮只记录候选，不落盘
        self.assertEqual(run.call_count, 1)
        self.assertEqual(output.getvalue(), "")

        with redirect_stdout(output):
            pending, applied = settle_sync(cfg, Path("/tmp/zukan"), pending)
        self.assertTrue(applied)  # 连续两轮一致 → 真正同步并打印
        self.assertIsNone(pending)
        self.assertEqual(run.call_count, 3)  # 第二轮 dry-run + 一次真实 rsync
        real_commands = [call.args[0] for call in run.call_args_list if "--dry-run" not in call.args[0]]
        self.assertEqual(len(real_commands), 1)
        self.assertIn("static/a.png", output.getvalue())

    @patch("remote_sync.shutil.which", return_value="/usr/bin/rsync")
    @patch("remote_sync.subprocess.run")
    def test_settle_sync_ignores_transient_clear_and_regenerate(self, run, _which) -> None:
        # 编译中间态：static 被清空（只剩删除项）。
        deleting = machine_line("*deleting", "static/a.png", 0, 0)
        plans = iter([deleting, ""])  # 下一轮已重建为相同内容 → 扫描为空
        run.side_effect = lambda command, **_kw: subprocess.CompletedProcess(
            command, 0, stdout=next(plans) if "--dry-run" in command else ""
        )
        cfg = {"remote": "u@h", "remote_dir": "/build", "ssh_cmd": "ssh", "ssh_port": "22"}

        output = StringIO()
        with redirect_stdout(output):
            pending, applied = settle_sync(cfg, Path("/tmp/zukan"), None)
            self.assertFalse(applied)
            self.assertEqual(len(pending), 1)
            pending, applied = settle_sync(cfg, Path("/tmp/zukan"), pending)
        self.assertFalse(applied)  # 中间态自行收敛，从未落盘
        self.assertIsNone(pending)
        self.assertEqual(output.getvalue(), "")
        self.assertTrue(all("--dry-run" in call.args[0]) for call in run.call_args_list)

    def test_rsync_command_excludes_python_and_os_caches(self) -> None:
        command = build_rsync_command(
            {
                "remote": "user@host",
                "remote_dir": "~/Code/zukan/scripts/remote-debug",
                "ssh_cmd": "ssh",
                "ssh_port": "22",
                "ssh_key": "",
            },
            Path("/tmp/remote-debug"),
            mirror=False,
            exclude_patterns=("__pycache__/", "pull.conf", "pull.conf.local", "*.py[cod]", ".DS_Store"),
        )
        self.assertEqual(
            command.count("--exclude"),
            5,
        )
        self.assertIn("__pycache__/", command)
        self.assertIn("pull.conf", command)
        self.assertIn("pull.conf.local", command)
        self.assertIn("*.py[cod]", command)
        self.assertIn(".DS_Store", command)

    @patch("remote_sync.shutil.which", return_value="/usr/bin/rsync")
    @patch("remote_sync.subprocess.run")
    def test_run_rsync_is_silent_when_no_files_change(self, run, _which) -> None:
        run.return_value = subprocess.CompletedProcess([], 0, stdout="Number of files: 3\n")
        output = StringIO()
        with redirect_stdout(output):
            run_rsync(
                {"remote": "user@host", "remote_dir": "/build", "ssh_cmd": "ssh", "ssh_port": "22"},
                Path("/tmp/zukan"),
            )
        self.assertEqual(output.getvalue(), "")

    @patch("remote_sync.shutil.which", return_value="/usr/bin/rsync")
    @patch("remote_sync.subprocess.run")
    def test_run_rsync_is_silent_when_only_attributes_differ(self, run, _which) -> None:
        # 仅权限不同 / 目录时间戳变化：%i 首字符为 .，无真实传输。
        stdout = (
            machine_line(".f...p.....", "app.js", 2002, 0)
            + "\n"
            + machine_line(".d..t......", "./", 120, 0)
            + "\n"
        )
        run.return_value = subprocess.CompletedProcess([], 0, stdout=stdout)
        output = StringIO()
        with redirect_stdout(output):
            run_rsync(
                {"remote": "user@host", "remote_dir": "/build", "ssh_cmd": "ssh", "ssh_port": "22"},
                Path("/tmp/zukan"),
            )
        self.assertEqual(output.getvalue(), "")

    @patch("remote_sync.shutil.which", return_value="/usr/bin/rsync")
    @patch("remote_sync.subprocess.run")
    def test_run_rsync_renders_changes_readably(self, run, _which) -> None:
        stdout = "\n".join(
            (
                machine_line("*deleting", "gone.txt", 0, 0),
                machine_line(">f+++++++++", "new.js", 12, 59),
                machine_line(">f.st......", "upd.js", 11, 52),
                machine_line("cd+++++++++", "newdir/", 60, 0),
                machine_line(">f+++++++++", "newdir/in.js", 2048, 90),
            )
        )
        run.return_value = subprocess.CompletedProcess([], 0, stdout=stdout + "\n")
        output = StringIO()
        with redirect_stdout(output):
            run_rsync(
                {"remote": "user@host", "remote_dir": "/build", "ssh_cmd": "ssh", "ssh_port": "22"},
                Path("/tmp/zukan"),
            )
        text = output.getvalue()
        self.assertIn("user@host:/build → /tmp/zukan", text)
        self.assertIn("删除", text)
        self.assertIn("新增", text)
        self.assertIn("更新", text)
        self.assertIn("new.js", text)
        self.assertIn("newdir/", text)
        self.assertIn("2.0 KB", text)  # 2048 字节由 Python 格式化
        self.assertIn("共 5 项", text)
        self.assertIn("完成", text)  # 结尾汇总带完成时间
        self.assertIn("耗时", text)  # 及本轮耗时

    def test_classify_change_maps_itemize_flags(self) -> None:
        self.assertEqual(classify_change("*deleting "), "delete")
        self.assertEqual(classify_change(">f+++++++++"), "create")
        self.assertEqual(classify_change("cd+++++++++"), "create")
        self.assertEqual(classify_change(">f.st......"), "update")
        self.assertEqual(classify_change(".f...p....."), "update")  # 不会被打印，但归类安全

    def test_human_size_uses_compact_units(self) -> None:
        self.assertEqual(human_size(0), "0 B")
        self.assertEqual(human_size(512), "512 B")
        self.assertEqual(human_size(2048), "2.0 KB")
        self.assertEqual(human_size(5 * 1024 * 1024), "5.0 MB")


class PullCliTests(unittest.TestCase):
    def test_missing_target_prints_help_and_error(self) -> None:
        script = Path(__file__).with_name("pull.py")
        result = subprocess.run(
            [sys.executable, str(script)],
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertEqual(result.returncode, 2)
        self.assertIn("usage: pull.py", result.stderr)
        self.assertIn("--target {app,mp-weixin}", result.stderr)
        self.assertIn("error: the following arguments are required: --target", result.stderr)


if __name__ == "__main__":
    unittest.main()
