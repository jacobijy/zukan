#!/usr/bin/env node
/**
 * mp-weixin dev watch 的看门狗：后台常驻，负责两件事——
 *
 * 1. watch 不在了就拉起。覆盖「机器重启后 detached watch 不会自启」（本仓库
 *    的 watch 是裸后台进程、不是服务）。前置步骤进行中（uni 尚未起、但 pidfile
 *    的 bash 还活）不算缺失，会等待而不是重复开。
 * 2. watch 「聋」了（进程还活、却停止增量编译）就先抓一帧现场，再重启。
 *
 * 聋的判定用 mtime 对账：src/ 最新源码改动若比 dist/dev/mp-weixin 最新产物
 * 输出「新」超过 GRACE_MS，且连续 STREAK_NEED 轮都如此，才判聋。正常增量
 * 编译只要几秒，阈值故意放得很宽，避免误杀。
 *
 * 抓现场的目的是定位根因（inotify 丢事件 vs 常驻 esbuild 卡死），不是终点；
 * 现场落 dist/watchdog/incident-*.log。运行日志 dist/mp-watchdog.log。
 *
 * 调参（均有默认，可用环境变量覆盖）：
 *   MP_WATCHDOG_CHECK_MS      每轮间隔（默认 20000）
 *   MP_WATCHDOG_GRACE_MS      源码改动后多少毫秒没产物算 stale（默认 90000）
 *   MP_WATCHDOG_STREAK        连续 stale 多少轮判聋（默认 3）
 *   MP_WATCHDOG_BOOT_GRACE_MS 新拉起 watch 后多少毫秒内不对账（默认 90000）
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  DIST,
  WATCH_LOG,
  pidfileAlive,
  findMpWatch,
} from './lib/mpWatchProc.mjs';

const CHECK_MS = Number(process.env.MP_WATCHDOG_CHECK_MS ?? 20000);
const GRACE_MS = Number(process.env.MP_WATCHDOG_GRACE_MS ?? 90000);
const STREAK_NEED = Number(process.env.MP_WATCHDOG_STREAK ?? 3);
const BOOT_GRACE_MS = Number(process.env.MP_WATCHDOG_BOOT_GRACE_MS ?? 90000);
const INCIDENT_KEEP = 10;

const DOG_LOG = path.join(DIST, 'mp-watchdog.log');
const INCIDENT_DIR = path.join(DIST, 'watchdog');
const WATCH_SCRIPT = path.join(ROOT, 'scripts', 'dev-mp-weixin-watch.mjs');
const PRODUCT_DIR = path.join(ROOT, 'dist', 'dev', 'mp-weixin');
const SRC_DIR = path.join(ROOT, 'src');

const SRC_EXT = new Set(['.vue', '.ts', '.js', '.json', '.css', '.scss']);
// 这些是 copy-wasm / build-icons 的生成物，改动不是「用户编辑源码」，纳入对账会误判。
const SRC_SKIP_DIRS = [
  path.join('src', 'infra', 'wasm', 'target'),
  path.join('src', 'static', 'wasm'),
  path.join('src', 'static', 'fonts'),
];
const SRC_SKIP_FILES = [path.join('src', 'components', 'icon', 'glyphs.ts')];

fs.mkdirSync(DIST, { recursive: true });
const logFd = fs.openSync(DOG_LOG, 'a');
function log(msg) {
  fs.writeSync(logFd, `${new Date().toISOString()} ${msg}\n`);
  console.log(msg);
}

/** 递归找 root 下 mtime 最大的文件，返回 { file, mtimeMs }。filter(abs,isDir) 为 false 则跳过。 */
function newestFile(root, filter) {
  let best = { file: null, mtime: 0 };
  const walk = (dir) => {
    let ents;
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of ents) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (filter && !filter(full, true)) continue;
        walk(full);
      } else if (ent.isFile()) {
        if (filter && !filter(full, false)) continue;
        let st;
        try {
          st = fs.statSync(full);
        } catch {
          continue;
        }
        if (st.mtimeMs > best.mtime) best = { file: full, mtime: st.mtimeMs };
      }
    }
  };
  walk(root);
  return best;
}

function srcFilter(abs, isDir) {
  const rel = path.relative(ROOT, abs);
  if (isDir) {
    return !SRC_SKIP_DIRS.some((d) => rel === d || rel.startsWith(d + path.sep));
  }
  if (SRC_SKIP_FILES.includes(rel)) return false;
  return SRC_EXT.has(path.extname(rel));
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return { out: r.stdout ?? '', err: r.stderr ?? '', status: r.status };
}
function sh(cmd) {
  return run('bash', ['-lc', cmd]);
}
function psLines(args) {
  const r = run('ps', args);
  return r.status === 0 ? r.out.trim() : '';
}

function startWatch(reason) {
  log(`启动 watch（${reason}）…`);
  const r = run('node', [WATCH_SCRIPT]);
  if (r.out.trim()) log(r.out.trim());
  if (r.err.trim()) log(r.err.trim());
  lastStart = Date.now();
  streak = 0;
}

function stopWatch(reason) {
  log(`停止 watch（${reason}）…`);
  const r = run('node', [WATCH_SCRIPT, '--stop']);
  if (r.out.trim()) log(r.out.trim());
  if (r.err.trim()) log(r.err.trim());
}

/** 判聋瞬间抓现场：进程/esbuild/inotify/strace/日志，落 incident 文件，便于事后区分根因。 */
function captureSnapshot(reason, src, prod) {
  fs.mkdirSync(INCIDENT_DIR, { recursive: true });
  const lines = [];
  const p = (s = '') => lines.push(s);

  p(`# watchdog 现场快照 ${new Date().toISOString()}`);
  p(`# 原因: ${reason}`);
  const rel = (f) => (f ? path.relative(ROOT, f) : '(未找到文件)');
  p(`# srcNewest : ${new Date(src.mtime).toISOString()}  ${rel(src.file)}`);
  p(`# prodNewest: ${new Date(prod.mtime).toISOString()}  ${rel(prod.file)}`);
  p(`# 源码比产物新 ${Math.round((src.mtime - prod.mtime) / 1000)}s`);
  p('');

  for (const { pid } of findMpWatch()) {
    p('## uni watch 进程');
    p(psLines(['-o', 'pid,ppid,pgid,etime,stat,nlwp,args', '-p', String(pid)]) || `pid ${pid} ps 失败`);
    p('');
    p('### /proc status 关键项');
    try {
      for (const line of fs.readFileSync(`/proc/${pid}/status`, 'utf8').split('\n')) {
        if (/^(State|Threads|VmRSS):/.test(line)) p(line);
      }
    } catch {}
    p('');
    p('### inotify（fd 数 / watch 数）');
    p(sh(`ls -l /proc/${pid}/fd 2>/dev/null | grep -c inotify; cat /proc/${pid}/fdinfo/* 2>/dev/null | grep -c 'inotify wd'`).out);
    p('### strace 3s（看是否还在 inotify/read 上收事件）');
    const tr = sh(`timeout 3 strace -f -e trace=inotify_init1,inotify_add_watch,read -p ${pid} 2>&1 | tail -n 25`);
    p(tr.out || tr.err || '(strace 无输出或不可用)');
    p('');
  }

  p('## esbuild service 进程');
  p(sh("ps -eo pid,ppid,etime,stat,args | grep '[e]sbuild'").out || '(无)');
  p('');
  p('## dev:h5 是否在跑（对照「h5 并存致 mp 聋」假设）');
  p(sh("ps -eo pid,ppid,etime,args | grep '[b]in/uni.js' | grep -v 'mp-weixin'").out || '(h5 未运行)');
  p('');
  p('## watch 日志末尾 40 行');
  try {
    p(fs.readFileSync(WATCH_LOG, 'utf8').split('\n').slice(-40).join('\n'));
  } catch {}

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(INCIDENT_DIR, `incident-${stamp}.log`);
  fs.writeFileSync(file, lines.join('\n') + '\n');

  // 只保留最近 INCIDENT_KEEP 份（诊断产物在 dist 下，直接 unlink）。
  const old = fs.readdirSync(INCIDENT_DIR).filter((f) => f.endsWith('.log')).sort();
  for (const f of old.slice(0, -INCIDENT_KEEP)) {
    try {
      fs.unlinkSync(path.join(INCIDENT_DIR, f));
    } catch {}
  }

  log(`现场已存 ${path.relative(ROOT, file)}`);
}

let streak = 0;
let lastStart = 0;

function tick() {
  const found = findMpWatch();

  if (found.length === 0) {
    // uni 不在：pidfile 的 bash 还活 = 前置步骤进行中，等待；否则真缺失，拉起。
    if (pidfileAlive()) {
      if (streak !== 0) {
        streak = 0;
        log('watch 前置步骤进行中（pidfile bash 在），等待就绪');
      }
      return;
    }
    log('watch 缺失（无 uni 进程且无存活 pidfile，含开机后未自启）');
    startWatch('watch 缺失');
    return;
  }

  // uni 在。刚由看门狗拉起的窗口期内不对账，给前置 + 首次编译留时间。
  if (Date.now() - lastStart < BOOT_GRACE_MS) {
    if (streak !== 0) streak = 0;
    return;
  }

  const src = newestFile(SRC_DIR, srcFilter);
  const prod = newestFile(PRODUCT_DIR);
  if (!src.file) return;

  // stale：最新源码改动比最新产物输出早出 GRACE_MS 仍没被编译。
  if (prod.mtime >= src.mtime - GRACE_MS) {
    if (streak > 0) log(`对账恢复正常，重置计数（之前连续 ${streak} 轮）`);
    streak = 0;
    return;
  }

  streak += 1;
  log(
    `疑似聋 ${streak}/${STREAK_NEED}：${path.relative(ROOT, src.file)} 改动后 ${Math.round(
      (src.mtime - prod.mtime) / 1000,
    )}s 仍无产物`,
  );
  if (streak < STREAK_NEED) return;

  log('判定 watch 已聋：抓现场后重启');
  try {
    captureSnapshot('连续对账 stale', src, prod);
  } catch (e) {
    log(`抓现场失败: ${e?.stack ?? e}`);
  }
  stopWatch('watch 已聋');
  // 等旧进程组真正退出，避免幂等的启动复用一个正在死的 watch。
  run('bash', ['-c', 'sleep 3']);
  startWatch('聋后自动重启');
}

log(
  `watchdog 启动：check=${CHECK_MS}ms grace=${GRACE_MS}ms streak=${STREAK_NEED} bootGrace=${BOOT_GRACE_MS}ms`,
);
const timer = setInterval(() => {
  try {
    tick();
  } catch (e) {
    log(`tick 异常: ${e?.stack ?? e}`);
  }
}, CHECK_MS);
tick();

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    log(`watchdog 退出（${sig}）`);
    clearInterval(timer);
    process.exit(0);
  });
}
