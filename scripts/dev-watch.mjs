#!/usr/bin/env node
/**
 * dev-watch.mjs — 多平台「同步 watch」统一控制入口
 *
 * 控制形态：
 *   node scripts/dev-watch.mjs <up|stop|restart|status> [platform ...]
 *   platform：mp-weixin（别名 weixin/wx/微信）| app；省略 = 全部已注册平台
 *
 * watcher 形态（由 up detached 自调，勿手动跑）：
 *   node scripts/dev-watch.mjs --zukan-app-watcher
 *
 * 平台行为：
 *   mp-weixin — 委托 scripts/dev-mp-weixin-watch.mjs，行为零改动（兼容看门狗/systemd）
 *   app       — 内置 fs.watch 监听 src，串行重跑 pnpm build:app；构建绝不中断，
 *               产物始终是标准发行目录 dist/build/app。
 */
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
    ROOT,
    APP_WATCHER_TAG,
    PLATFORMS,
    resolvePlatform,
    readPidfile,
    findPlatformWatch,
    findAppWatcher,
} from './lib/platformWatchProc.mjs';

const TRIGGER_EXT = /\.(ts|vue|js|css|json|scss)$/;
const DEBOUNCE_MS = 400;
const FIRST_BUILD_TIMEOUT = 120_000;

const log = (s) => printf(`[dev-watch] ${s}\n`);
const err = (s) => printf(`[dev-watch] ERROR: ${s}\n`, 'stderr');

function printf(s, stream = 'stdout') {
    fs.writeSync(stream === 'stderr' ? 2 : 1, s);
}

function sleepMs(ms) {
    // 仅控制端用；Atomics 阻塞，避免引入异步 timer。
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, ms);
}

function hhmmss(t = Date.now()) {
    return new Date(t).toTimeString().slice(0, 8);
}

function readState(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}

function etime(pid) {
    const r = spawnSync('bash', ['-c', `ps -o etime= -p ${pid} 2>/dev/null | tr -d ' '`], {
        encoding: 'utf8',
    });
    return r.stdout.trim() || '?';
}

// ==================== app watcher 形态 ====================

function runAppWatcher() {
    const p = PLATFORMS.app;
    fs.mkdirSync(path.dirname(p.log), { recursive: true });
    const logFd = fs.openSync(p.log, 'a');
    const wlog = (s) => fs.writeSync(logFd, `[${hhmmss()}] ${s}\n`);
    const writeState = (s) => fs.writeFileSync(p.stateFile, JSON.stringify({ ...s, at: Date.now() }));

    let running = false;
    let queued = false;
    let timer = null;
    let lastResult = null;
    let current = null;

    function runBuild() {
        return new Promise((resolve) => {
            running = true;
            writeState({ phase: 'building', last: lastResult });
            const t0 = Date.now();
            wlog('build:app 开始');
            // bash -lc 以继承 pnpm 的 node_modules/.bin 环境（同 mp watch 做法）。
            const child = spawn('bash', ['-lc', p.buildCmd], {
                cwd: ROOT,
                stdio: ['ignore', logFd, logFd],
                env: process.env,
            });
            current = child;
            child.on('error', (e) => wlog('build 启动失败: ' + e.message));
            child.on('exit', (code) => {
                current = null;
                const ok = code === 0;
                lastResult = ok ? 'ok' : 'fail';
                wlog(`build:app ${ok ? '完成' : `失败(code=${code})`} ${Date.now() - t0}ms`);
                writeState({ phase: 'idle', last: lastResult });
                running = false;
                resolve();
            });
        });
    }

    // 串行泵：一次只跑一个 build；运行期间的多次变更合并为 queued，结束后最多补跑一次，
    // 绝不向正在跑的 build 发信号 —— 保证 dist/build/app 每次完整落盘。
    async function pump() {
        if (running) return;
        do {
            queued = false;
            await runBuild();
        } while (queued);
    }

    function schedule(immediate) {
        if (running) {
            queued = true;
            return;
        }
        clearTimeout(timer);
        timer = setTimeout(pump, immediate ? 0 : DEBOUNCE_MS);
    }

    try {
        fs.watch(p.watchDir, { recursive: true }, (_event, file) => {
            if (file && TRIGGER_EXT.test(file)) schedule(false);
        });
        wlog(`app watcher 启动，监听 ${path.relative(ROOT, p.watchDir)}`);
    } catch (e) {
        wlog('fs.watch 启动失败: ' + e.message);
    }

    writeState({ phase: 'building', last: null });
    schedule(true); // 首次立即构建

    // stop 以「杀 watcher 进程组」带走 watcher 与在跑的 build；这里只负责干净退出。
    const onTerm = () => process.exit(0);
    process.on('SIGTERM', onTerm);
    process.on('SIGINT', onTerm);
}

// ==================== 控制形态：mp-weixin（委托） ====================

function runMpControl(args) {
    const r = spawnSync('node', ['scripts/dev-mp-weixin-watch.mjs', ...args], {
        cwd: ROOT,
        stdio: 'inherit',
    });
    return r.status === 0 ? 0 : 1;
}

// ==================== 控制形态：app ====================

function appUp() {
    const p = PLATFORMS.app;
    const existing = readPidfile(p.pidfile) ?? (findAppWatcher()[0]?.pid ?? null);
    if (existing) {
        const st = readState(p.stateFile);
        log(`app: watcher 运行中 pid=${existing} (reused)${st ? `，last=${st.last ?? '-'}` : ''}`);
        return 0;
    }

    fs.mkdirSync(path.dirname(p.pidfile), { recursive: true });
    fs.rmSync(p.stateFile, { force: true }); // 清旧状态，确保轮询读到的是本次首轮
    const out = fs.openSync(p.log, 'a');
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'dev-watch.mjs'), APP_WATCHER_TAG], {
        cwd: ROOT,
        stdio: ['ignore', out, out],
        detached: true,
        env: process.env,
    });
    child.unref();
    fs.writeFileSync(p.pidfile, String(child.pid));
    log('app: 启动 watcher，等待首次 build:app …（约数十秒）');

    const deadline = Date.now() + FIRST_BUILD_TIMEOUT;
    while (Date.now() < deadline) {
        const st = readState(p.stateFile);
        if (st && st.last) {
            if (st.last === 'ok') {
                log(`app: 首次 build 完成，pid=${child.pid}`);
                return 0;
            }
            err('app: 首次 build 失败');
            tailLog(p.log);
            return 1;
        }
        sleepMs(500);
    }
    err('app: 首次 build 超时（120s 未完成）');
    tailLog(p.log);
    return 1;
}

function tailLog(file) {
    const r = spawnSync('bash', ['-c', `tail -n 50 ${file}`], { encoding: 'utf8' });
    printf(r.stdout || '(无日志)\n', 'stderr');
}

function appStop() {
    const p = PLATFORMS.app;
    // 向 watcher 进程组（pidfile）与所有探测到的 watcher 发信号。
    // 注意 signal 用规范全名 'SIGTERM'：Node process.kill 在本机对 'TERM' 报
    // ERR_UNKNOWN_SIGNAL（shell kill 才接受短名）。
    const signalAll = (sig) => {
        const pid = readPidfile(p.pidfile);
        if (pid) {
            try {
                process.kill(-pid, sig);
            } catch {
                try {
                    process.kill(pid, sig);
                } catch {}
            }
        }
        for (const { pid: wp, pgid } of findAppWatcher()) {
            try {
                process.kill(-pgid, sig);
            } catch {
                try {
                    process.kill(wp, sig);
                } catch {}
            }
        }
    };

    signalAll('SIGTERM');
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
        if (findAppWatcher().length === 0) break;
        sleepMs(200);
    }
    if (findAppWatcher().length > 0) {
        err('app: SIGTERM 后仍存活，升级 SIGKILL');
        signalAll('SIGKILL');
        sleepMs(500);
    }

    const alive = findAppWatcher().length > 0;
    fs.rmSync(p.pidfile, { force: true });
    fs.rmSync(p.stateFile, { force: true });
    if (alive) {
        err('app: 仍有 watcher 进程未退出');
        return 1;
    }
    log('app: stopped');
    return 0;
}

// ==================== 控制形态：status ====================

function platformStatus(id) {
    const p = PLATFORMS[id];
    const found = findPlatformWatch(id);
    // mp-weixin 以 uni 编译器 pid 为准（同 dev-mp-weixin-watch --status）；
    // app 以 watcher pidfile 为准。
    const pid = id === 'mp-weixin' ? found[0]?.pid ?? readPidfile(p.pidfile) : readPidfile(p.pidfile) ?? found[0]?.pid;

    if (!pid) {
        printf(`${id}: down\n`);
        return;
    }
    let extra = '';
    if (id === 'app') {
        const st = readState(p.stateFile);
        if (st) extra = ` phase=${st.phase} last=${st.last ?? '-'} @${hhmmss(st.at)}`;
    }
    printf(`${id}: running pid=${pid} uptime=${etime(pid)}${extra}；log=${path.relative(ROOT, p.log)}\n`);
}

// ==================== dispatcher ====================

function normalizeAction(a) {
    switch (a) {
        case 'up':
        case 'start':
        case 'run':
        case '启动':
        case '起':
            return 'up';
        case 'stop':
        case '停':
        case '关闭':
            return 'stop';
        case 'restart':
        case '重启':
            return 'restart';
        case 'status':
        case '状态':
            return 'status';
        default:
            return null;
    }
}

function main() {
    const argv = process.argv.slice(2);
    if (argv.includes(APP_WATCHER_TAG)) {
        runAppWatcher();
        return;
    }

    const action = normalizeAction(argv[0] ?? 'up');
    if (!action) {
        err(`未知 action: ${argv[0]}  (up|stop|restart|status)`);
        process.exit(2);
    }

    const requested = argv.slice(1);
    let ids;
    if (requested.length === 0) {
        ids = Object.keys(PLATFORMS);
    } else {
        ids = [];
        for (const r of requested) {
            const id = resolvePlatform(r);
            if (!id) {
                err(`未知 platform: ${r}  (${Object.keys(PLATFORMS).join('|')})`);
                process.exit(2);
            }
            if (!ids.includes(id)) ids.push(id);
        }
    }

    let rc = 0;
    for (const id of ids) {
        if (action === 'status') {
            platformStatus(id);
            continue;
        }
        if (id === 'mp-weixin') {
            if (action === 'up') rc = runMpControl([]) || rc;
            else if (action === 'stop') rc = runMpControl(['--stop']) || rc;
            else rc = (runMpControl(['--stop']) === 0 ? runMpControl([]) : 1) || rc;
        } else if (id === 'app') {
            if (action === 'up') rc = appUp() || rc;
            else if (action === 'stop') rc = appStop() || rc;
            else rc = (appStop() === 0 ? appUp() : 1) || rc;
        }
    }
    process.exit(rc);
}

main();
