#!/usr/bin/env node
/**
 * 在后台启动 mp-weixin 的 dev watch 构建，可重复调用（幂等）。
 *
 * 直接跑 `pnpm dev:mp-weixin` 是前台常驻进程，会话一结束就被杀掉——每次都得
 * 手动查残留进程、还得小心别误杀占用同一端口的 H5 dev。这个脚本把那件事收口：
 *
 *   node scripts/dev-mp-weixin-watch.mjs     # 启动（已在跑则复用，不重复开）
 *   node scripts/dev-mp-weixin-watch.mjs --stop    # 只停 mp-weixin 的 watch
 *   node scripts/dev-mp-weixin-watch.mjs --status  # 看状态
 *
 * 前置步骤（copy-wasm、build-icons）在子进程内跑，不放进包名的 shell 串联里——
 * 否则父进程退出、子进程还没跑到前置步骤时，前置就被跳过了。
 *
 * 识别方式按命令行匹配 `-p mp-weixin`，所以不会碰 `dev:h5`（它的 uni 进程不带
 * `-p`，共用 4000 端口也不会被误杀）。
 *
 * 日志落 dev-mp-weixin-watch.log（与 dist 同级，已被 .gitignore 的 dist 覆盖），
 * 排障时 `tail -f` 看。
 */
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LOG = path.join(ROOT, 'dist', 'mp-weixin-watch.log');
const PIDFILE = path.join(ROOT, 'dist', 'mp-weixin-watch.pid');
const ARGV = process.argv.slice(2);

/** pidfile 记录的 bash 是否仍存活（即 watch 是否还在跑） */
function pidfileAlive() {
    const raw = fs.readFileSync(PIDFILE, 'utf8').trim();
    const pid = Number(raw);
    if (!Number.isInteger(pid) || pid <= 0) return null;
    try {
        process.kill(pid, 0); // 只探测存活，不发信号
        return pid;
    } catch {
        return null;
    }
}

/**
 * 找出所有正在跑的 mp-weixin watch：返回 [{ pid, pgid }]。
 *
 * 直接扫 /proc，不用 `ps -C node`——本机 node 进程的 comm 名是 `MainThread`
 * 而非 `node`，`-C` 会漏掉全部。也不只用命令行匹配外壳进程：真正的 uni 子进程
 * 才持有产物写入权，停止时按进程组杀（见 stop），避免留下孤儿。
 *
 * 匹配条件：cmdline 含 vite-plugin-uni/bin/uni.js 且结尾为 `-p mp-weixin`。
 * 这样不会误伤 `dev:h5`（它的 uni 命令行不带 `-p`，且共用 4000 端口）。
 */
function findWatch() {
    const out = [];
    for (const pidStr of fs.readdirSync('/proc')) {
        if (!/^\d+$/.test(pidStr)) continue;
        let cmdline, stat;
        try {
            cmdline = fs.readFileSync(`/proc/${pidStr}/cmdline`, 'utf8');
            stat = fs.readFileSync(`/proc/${pidStr}/stat`, 'utf8');
        } catch {
            continue; // 进程已退出
        }
        const args = cmdline.split('\0').filter(Boolean);
        if (!args.some((a) => a.includes('vite-plugin-uni/bin/uni.js'))) continue;
        const tail = args.slice(-2);
        if (tail[tail.length - 2] !== '-p' || tail[tail.length - 1] !== 'mp-weixin') continue;
        // stat 里 pgid 是第 5 个字段（comm 可能含空格，取最后一个 ')' 之后）
        const afterClose = stat.slice(stat.lastIndexOf(')') + 2);
        const pgid = Number(afterClose.split(' ')[3]);
        out.push({ pid: Number(pidStr), pgid });
    }
    return out;
}

function stop() {
    const found = findWatch();
    if (found.length === 0) console.log('没有在跑的 mp-weixin watch');
    const groups = new Map(); // pgid -> [pids]
    for (const { pid, pgid } of found) {
        const list = groups.get(pgid) ?? [];
        list.push(pid);
        groups.set(pgid, list);
    }
    for (const [pgid, pids] of groups) {
        // 先按进程组杀：能一次带走外壳 + uni。孤儿进程的原 pgid 可能已失效
        // （ESRCH），此时退回到逐个 pid 杀，保证不留残留。
        try {
            process.kill(-pgid, 'SIGTERM');
            console.log(`已停止进程组 pgid=${pgid}（${pids.join(', ')}）`);
        } catch {
            for (const pid of pids) {
                try {
                    process.kill(pid, 'SIGTERM');
                    console.log(`已停止 pid=${pid}（组 pgid=${pgid} 无效，按 pid 杀）`);
                } catch {
                    console.log(`无法停止 pid=${pid}（可能已退出）`);
                }
            }
        }
    }
}

function status() {
    const found = findWatch();
    if (found.length === 0) {
        console.log('mp-weixin watch: 未在运行');
        return [];
    }
    for (const { pid, pgid } of found) {
        const { stdout } = spawnSync('bash', [
            '-c',
            `ps -o etime= -p ${pid} 2>/dev/null | tr -d ' '`,
        ], { encoding: 'utf8' });
        console.log(`mp-weixin watch: 运行中 pid=${pid} pgid=${pgid}（已运行 ${stdout.trim()}）`);
    }
    console.log(`  日志: ${path.relative(ROOT, LOG)}`);
    return found;
}

if (ARGV.includes('--stop')) {
    stop();
    process.exit(0);
}

if (ARGV.includes('--status')) {
    status();
    process.exit(0);
}

// 幂等：已有存活 watch 就复用。用 pidfile 判（bash 存活即可靠），
// findWatch 只在 status 展示时用——它查 uni 进程，前置步骤未跑完时查不到。
const alivePid = (() => {
    try {
        return pidfileAlive();
    } catch {
        return null;
    }
})();
if (alivePid) {
    status();
    console.log('已在运行，复用现有 watch（如需重启用 --stop 后再跑）');
    process.exit(0);
}

fs.mkdirSync(path.dirname(LOG), { recursive: true });
const out = fs.openSync(LOG, 'a');

// 复用包名 dev:mp-weixin（已串好 copy-wasm → build-icons → uni），经 bash -lc 启动以
// 继承 pnpm 的 node_modules/.bin 环境。detached：脱离当前进程组，会话结束后仍常驻；
// 日志追加落盘，tail -f 可跟。
const child = spawn('bash', ['-lc', 'pnpm dev:mp-weixin'], {
    cwd: ROOT,
    stdio: ['ignore', out, out],
    detached: true,
    env: process.env,
});
child.unref();

// 记 pidfile：bash 会一直存活到 uni 结束，所以「bash 存活」就是 watch 在跑的可靠判据。
// 不用 findWatch 做幂等判断——刚 fork 时 uni 还没起来，前置步骤要跑十几秒，
// 那段窗口内查 uni 会误判「未在运行」而重复开一个。
fs.writeFileSync(PIDFILE, String(child.pid));

child.on('error', (err) => {
    fs.rmSync(PIDFILE, { force: true });
    console.error('启动失败:', err.message);
    process.exit(1);
});
console.log(`已启动 mp-weixin watch（pid=${child.pid}）`);
console.log(`  日志: ${path.relative(ROOT, LOG)}`);
console.log('  tail -f 该文件可跟踪构建输出；--stop 停止');
