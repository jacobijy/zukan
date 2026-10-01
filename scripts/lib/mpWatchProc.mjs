/**
 * mp-weixin watch 进程探测的共享工具：dev-mp-weixin-watch.mjs（启停）与
 * mp-watch-watchdog.mjs（看门狗）都用它，避免两处匹配逻辑漂移。
 *
 * 匹配的是 @dcloudio/vite-plugin-uni 的 uni.js 且命令行以 `-p mp-weixin`
 * 结尾的进程——它才是真正持有产物写入权的编译器。dev:h5 的 uni 进程不带
 * `-p`，即使共用 4000 端口也不会被误判进来。
 */
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = process.cwd();
export const DIST = path.join(ROOT, 'dist');
export const WATCH_LOG = path.join(DIST, 'mp-weixin-watch.log');
export const PIDFILE = path.join(DIST, 'mp-weixin-watch.pid');

/** pidfile 记录的 bash 是否仍存活；返回 pid 或 null（含 pidfile 缺失/非法）。 */
export function pidfileAlive() {
    let raw;
    try {
        raw = fs.readFileSync(PIDFILE, 'utf8').trim();
    } catch {
        return null;
    }
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
 * 找出所有正在跑的 mp-weixin watch 编译器：返回 [{ pid, pgid }]。
 *
 * 直接扫 /proc，不用 `ps -C node`——本机 node 进程 comm 名是 `MainThread`
 * 而非 `node`，`-C` 会漏掉全部。stat 里的 pgid 是最后一个 ')' 之后第 4 个字段
 * （comm 本身可能含空格，必须从最后一个 ')' 切）。
 */
export function findMpWatch() {
    const out = [];
    let entries;
    try {
        entries = fs.readdirSync('/proc');
    } catch {
        return out;
    }
    for (const pidStr of entries) {
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
        const afterClose = stat.slice(stat.lastIndexOf(')') + 2);
        const pgid = Number(afterClose.split(' ')[3]);
        out.push({ pid: Number(pidStr), pgid });
    }
    return out;
}
