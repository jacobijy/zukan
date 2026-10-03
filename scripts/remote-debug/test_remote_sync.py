from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from remote_sync import build_rsync_command, get_target_config, parse_config, run_rsync


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

    def test_rsync_command_includes_verbose_file_metadata(self) -> None:
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
        self.assertIn("--stats", command)
        self.assertIn("--out-format=[%t] mtime=%M size=%l transferred=%b change=%i path=%n%L", command)
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
    def test_run_rsync_prints_output_when_files_change(self, run, _which) -> None:
        changed_file = "[2026/10/02 12:00:00] mtime=2026/10/02 size=10 transferred=10 change=>f+++++++++ path=file.bin\n"
        run.return_value = subprocess.CompletedProcess([], 0, stdout=changed_file)
        output = StringIO()
        with redirect_stdout(output):
            run_rsync(
                {"remote": "user@host", "remote_dir": "/build", "ssh_cmd": "ssh", "ssh_port": "22"},
                Path("/tmp/zukan"),
            )
        self.assertIn("从 user@host:/build", output.getvalue())
        self.assertIn(changed_file, output.getvalue())


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
