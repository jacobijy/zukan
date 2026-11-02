from __future__ import annotations

import hashlib
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

import pull
from remote_sync import (
    ChangeEntry,
    build_remote_manifest_command,
    build_rsync_command,
    build_sftp_batch,
    build_sftp_command,
    change_signature,
    classify_change,
    get_target_config,
    human_size,
    local_manifest,
    parse_config,
    parse_remote_manifest,
    plan_sftp_changes,
    run_rsync,
    run_sftp_fetch,
    settle_sftp_sync,
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


class SftpFetchTests(unittest.TestCase):
    def test_sftp_command_maps_port_and_key(self) -> None:
        command = build_sftp_command(
            {
                "remote": "user@host",
                "ssh_cmd": "ssh",
                "ssh_port": "2222",
                "ssh_key": "",
            }
        )
        self.assertEqual(command[:3], ["sftp", "-b", "-"])
        self.assertIn("-P", command)
        self.assertIn("2222", command)
        self.assertEqual(command[-1], "user@host")

    def test_sftp_command_converts_ssh_port_option(self) -> None:
        # SSH_CMD 里已带 -p 时透传为 -P，且不再重复追加 SSH_PORT。
        command = build_sftp_command(
            {
                "remote": "user@host",
                "ssh_cmd": "ssh -p 2200 -o BatchMode=yes",
                "ssh_port": "22",
                "ssh_key": "",
            }
        )
        self.assertNotIn("-p", command)
        self.assertEqual(command[command.index("-P") + 1], "2200")
        self.assertIn("BatchMode=yes", command)

    def test_sftp_batch_strips_tilde_from_home_relative_dir(self) -> None:
        # sftp 不展开 ~，登录后已在远端家目录，所以 ~/x 要写成相对路径 x。
        batch = build_sftp_batch(
            "~/Code/zukan/scripts/remote-debug/",
            Path("/local/scripts"),
            ("README.md", "pull.py"),
        )
        self.assertIn("cd Code/zukan/scripts/remote-debug\n", batch)
        self.assertNotIn("~", batch)
        self.assertIn("lcd /local/scripts\n", batch)
        self.assertIn("get README.md\n", batch)
        self.assertIn("get pull.py\n", batch)
        self.assertNotIn("pull.conf", batch)

    def test_sftp_batch_keeps_absolute_dir_and_skips_cd_for_home(self) -> None:
        absolute = build_sftp_batch("/srv/scripts", Path("/local"), ("pull.py",))
        self.assertIn("cd /srv/scripts\n", absolute)

        home = build_sftp_batch("~", Path("/local"), ("pull.py",))
        self.assertFalse(any(line.startswith("cd ") for line in home.splitlines()))

    def test_sftp_batch_rejects_user_home_shorthand(self) -> None:
        with self.assertRaises(ValueError):
            build_sftp_batch("~jacobi/Code/zukan", Path("/local"), ("pull.py",))

    def test_sftp_batch_quotes_paths_with_spaces(self) -> None:
        batch = build_sftp_batch("~/my scripts", Path("C:/Users/Test User/scripts"), ("pull.py",))
        self.assertIn('cd "my scripts"', batch)
        self.assertIn('lcd "C:/Users/Test User/scripts"', batch)

    @patch("remote_sync.shutil.which", return_value="/usr/bin/sftp")
    @patch("remote_sync.subprocess.run")
    def test_run_sftp_fetch_feeds_batch_and_is_quiet(self, run, _which) -> None:
        run.return_value = subprocess.CompletedProcess([], 0, stdout="sftp> get pull.py\n", stderr="")
        output = StringIO()
        with redirect_stdout(output):
            run_sftp_fetch(
                {"remote": "user@host", "remote_dir": "/remote", "ssh_cmd": "ssh", "ssh_port": "22"},
                Path("/local"),
                ("pull.py",),
            )
        self.assertEqual(output.getvalue(), "")
        self.assertEqual(run.call_args.kwargs["input"], "cd /remote\nlcd /local\nget pull.py\n")

    @patch("remote_sync.shutil.which", return_value="/usr/bin/sftp")
    @patch("remote_sync.subprocess.run")
    def test_run_sftp_fetch_raises_on_failure(self, run, _which) -> None:
        run.return_value = subprocess.CompletedProcess([], 1, stdout="", stderr="Permission denied\n")
        with self.assertRaises(RuntimeError) as caught:
            run_sftp_fetch(
                {"remote": "user@host", "remote_dir": "/remote", "ssh_cmd": "ssh", "ssh_port": "22"},
                Path("/local"),
                ("pull.py",),
            )
        self.assertIn("Permission denied", str(caught.exception))
        self.assertIn("/remote", str(caught.exception))


def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def manifest_stdout(files: dict[str, bytes]) -> str:
    """构造 ssh 远端清单命令的输出（大小段 + 分隔符 + MD5 段）。"""
    sizes = "".join(f"{len(data)}\t./{path}\n" for path, data in files.items())
    hashes = "".join(f"{md5(data)}  ./{path}\n" for path, data in files.items())
    return sizes + "--HASH--\n" + hashes


class SftpSyncFallbackTests(unittest.TestCase):
    def test_remote_manifest_command_runs_md5_on_remote(self) -> None:
        command = build_remote_manifest_command(
            {"remote": "user@host", "remote_dir": "~/Code/zukan/dist", "ssh_cmd": "ssh", "ssh_port": "22"}
        )
        self.assertEqual(command[0], "ssh")
        self.assertEqual(command[1], "user@host")
        self.assertIn("~/Code/zukan/dist", command[2])
        self.assertIn("md5sum", command[2])

    def test_parse_remote_manifest_pairs_size_and_hash(self) -> None:
        manifest = parse_remote_manifest(manifest_stdout({"a.js": b"hello", "pages/b.wxml": b"x"}))
        self.assertEqual(
            manifest,
            {"a.js": (5, md5(b"hello")), "pages/b.wxml": (1, md5(b"x"))},
        )
        self.assertEqual(parse_remote_manifest(""), {})

    def test_plan_sftp_changes_detects_create_update_delete(self) -> None:
        remote = {"same.js": (1, "aaa"), "new.js": (2, "bbb"), "changed.js": (3, "ccc")}
        local = {"same.js": (1, "aaa"), "changed.js": (3, "old"), "gone.js": (4, "ddd")}
        plan = plan_sftp_changes(remote, local)
        self.assertEqual(
            [(entry.kind, entry.path) for entry in plan],
            [("update", "changed.js"), ("create", "new.js"), ("delete", "gone.js")],
        )
        self.assertEqual(
            [(entry.kind, entry.path) for entry in plan_sftp_changes(remote, local, mirror=False)],
            [("update", "changed.js"), ("create", "new.js")],
        )

    def test_local_manifest_hashes_files_recursively(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            base = Path(temp_dir)
            (base / "sub").mkdir()
            (base / "a.js").write_bytes(b"a")
            (base / "sub" / "b.js").write_bytes(b"bb")
            manifest = local_manifest(base)
            self.assertEqual(manifest["a.js"], (1, md5(b"a")))
            self.assertEqual(manifest["sub/b.js"], (2, md5(b"bb")))

    @patch("remote_sync.shutil.which", return_value="/usr/bin/tool")
    @patch("remote_sync.subprocess.run")
    def test_settle_sftp_sync_applies_after_two_stable_manifests(self, run, _which) -> None:
        remote_files = {"a.js": b"v2", "new.js": b"n"}
        sftp_batches: list[str] = []

        def fake_run(command, **kwargs):
            if command[0] == "ssh":
                return subprocess.CompletedProcess(
                    command, 0, stdout=manifest_stdout(remote_files), stderr=""
                )
            sftp_batches.append(kwargs.get("input", ""))
            return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

        run.side_effect = fake_run
        with tempfile.TemporaryDirectory() as temp_dir:
            base = Path(temp_dir)
            (base / "a.js").write_bytes(b"v1")
            (base / "gone.js").write_bytes(b"g")

            output = StringIO()
            cfg = {
                "remote": "user@host",
                "remote_dir": "/build",
                "ssh_cmd": "ssh",
                "ssh_port": "22",
                "ssh_key": "",
            }
            with redirect_stdout(output):
                pending, applied = settle_sftp_sync(cfg, base, None)
            self.assertFalse(applied)  # 首轮只记候选
            self.assertEqual(
                pending, {"a.js": (2, md5(b"v2")), "new.js": (1, md5(b"n"))}
            )
            self.assertEqual(sftp_batches, [])
            self.assertEqual(output.getvalue(), "")

            with redirect_stdout(output):
                pending, applied = settle_sftp_sync(cfg, base, pending)
            self.assertTrue(applied)
            self.assertIsNone(pending)
            self.assertEqual(len(sftp_batches), 1)
            self.assertIn("get a.js", sftp_batches[0])
            self.assertIn("get new.js", sftp_batches[0])
            self.assertNotIn("gone.js", sftp_batches[0])
            self.assertFalse((base / "gone.js").exists())  # 镜像删除
            self.assertIn("共 3 项", output.getvalue())


class PullTransportTests(unittest.TestCase):
    @patch("pull.run_sftp_sync")
    @patch("pull.run_rsync")
    @patch("pull.shutil.which", return_value="/usr/bin/rsync")
    def test_sync_once_prefers_rsync(self, _which, run_rsync, run_sftp) -> None:
        pull.sync_once({"local_dir": "/tmp/zukan"})
        run_rsync.assert_called_once()
        run_sftp.assert_not_called()

    @patch("pull.run_sftp_sync")
    @patch("pull.run_rsync")
    @patch("pull.shutil.which", return_value=None)
    def test_sync_once_falls_back_to_sftp(self, _which, run_rsync, run_sftp) -> None:
        pull.sync_once({"local_dir": "/tmp/zukan"})
        run_sftp.assert_called_once()
        run_rsync.assert_not_called()


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
