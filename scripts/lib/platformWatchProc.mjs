/**
 * 多平台「同步 watch」的注册表与进程探测（dev-watch.mjs 的底层库）。
 *
 * 设计为可扩展：新增一个平台只需在 PLATFORMS 里登记。当前启用：
 *   - mp-weixin：委托既有脚本，路径/检测全部复用 mpWatchProc.mjs，保证与
 *     看门狗（mp-watch-watchdog.mjs）/ systemd 逐字节兼容；
 *   - app：内置文件监听（见 dev-watch.mjs），产物为标准发行目录 dist/build/app。
 */
import fs from 'node:fs';
import path from 'node:path';
import * as mp from './mpWatchProc.mjs';

export const ROOT = process.cwd();

/** app watcher 后台进程在 /proc cmdline 中的识别标记（作为参数传入）。 */
export const APP_WATCHER_TAG = '--zukan-app-watcher';

export const PLATFORMS = {
    'mp-weixin': {
        kind: 'delegate',
        pidfile: mp.PIDFILE, // dist/mp-weixin-watch.pid（看门狗依赖，勿改）
        log: mp.WATCH_LOG, // dist/mp-weixin-watch.log
        aliases: ['weixin', 'wx', '微信'],
    },
    app: {
        kind: 'app',
        pidfile: path.join(ROOT, 'dist', 'app-watch.pid'),
        log: path.join(ROOT, 'dist', 'app-watch.log'),
        stateFile: path.join(ROOT, 'dist', 'app-watch.state.json'),
        outDir: path.join(ROOT, 'dist', 'build', 'app'),
        buildCmd: 'pnpm build:app',
        watchDir: path.join(ROOT, 'src'),
        aliases: [],
    },
};

/** 按 id 或别名解析平台；返回规范 id，找不到返回 null。 */
export function resolvePlatform(name) {
    if (Object.prototype.hasOwnProperty.call(PLATFORMS, name)) return name;
    for (const [id, p] of Object.entries(PLATFORMS)) {
        if (p.aliases.includes(name)) return id;
    }
    return null;
}

/** 读 pidfile 并探测进程存活；返回 pid 或 null（pidfile 缺失/非法/进程已死）。 */
export function readPidfile(pidfile) {
    let raw;
    try {
        raw = fs.readFileSync(pidfile, 'utf8').trim();
    } catch {
        return null;
    }
    const pid = Number(raw);
    if (!Number.isInteger(pid) || pid <= 0) return null;
    try {
        process.kill(pid, 0);
        return pid;
    } catch {
        return null;
    }
}

/**
 * 找出后台 app watcher：扫 /proc，匹配 cmdline 含 APP_WATCHER_TAG 的 node 进程。
 * 直接扫 /proc 的理由同 mpWatchProc（本机 node comm 是 MainThread，ps -C node 会漏）。
 * 返回 [{ pid, pgid }]。
 */
export function findAppWatcher() {
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
            continue;
        }
        const args = cmdline.split('\0').filter(Boolean);
        if (!args.includes(APP_WATCHER_TAG)) continue;
        const afterClose = stat.slice(stat.lastIndexOf(')') + 2);
        const pgid = Number(afterClose.split(' ')[3]);
        out.push({ pid: Number(pidStr), pgid });
    }
    return out;
}

/**
 * 平台运行探测：返回 [{ pid, pgid }]。
 * - app：后台 watcher 进程；
 * - mp-weixin：真正持产物写入权的 uni 编译器（复用 mpWatchProc）。
 */
export function findPlatformWatch(id) {
    const p = PLATFORMS[id];
    if (!p) return [];
    if (id === 'app') return findAppWatcher();
    if (id === 'mp-weixin') return mp.findMpWatch();
    return [];
}
