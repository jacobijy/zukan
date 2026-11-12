# 前端 H5 部署手册

> 面向：把 zukan 前端（uni-app H5 构建产物）发布到线上服务器，与 zukan-server 后端
> 同域、同 nginx 对外提供服务。
>
> 本手册只覆盖**前端侧**流程（构建 → 上传 → nginx 衔接 → 验收）。后端（zukan-server
> Docker Compose 两容器、加密资源、数据库等）的部署见
> zukan-server `docs/deployment.md`，本手册引用的段落会在文中标注。

---

## 1. 部署形态

```
                         ┌──────────────── 服务器 ────────────────┐
  客户端 ──HTTPS──▶ Nginx ──┬─▶ H5 静态（/srv/zukan/www）          │
  （浏览器 H5）              ├─▶ 127.0.0.1:8080  zukan-server 容器 │
                            │        （/api、/assets/encrypted…）   │
                            └───────────────────────────────────────┘
```

| 组件 | 来源 | 说明 |
|---|---|---|
| H5 静态产物 | **构建机** `pnpm build:h5` → rsync | 前端页面，nginx 直接读盘返回（SPA） |
| API / 加密资源 | zukan-server 容器（127.0.0.1:8080） | `/api/**` 反代；`/assets/encrypted/**` 可由 nginx 直出（见 §5） |

- **同域单 nginx**：根路径服务前端静态，`/api`、`/assets/encrypted` 等反代 / 直出后端。
  这样前端**构建时不设 `VITE_API_BASE_URL`**，请求走同源相对路径即可。
- 服务器**不装前端源码、不运行构建**：产物全在构建机生成，与后端「构建机出包」模式一致。

> 与其他端的发布区分：**App / 各小程序不走这套流程**（各自 `pnpm build:mp-*` /
> `build:app`，见 [架构总览](../architecture/overview.md)；微信/App 调试期产物同步见
> [mp-weixin-remote-debug.md](../architecture/mp-weixin-remote-debug.md)、
> [app-remote-debug.md](../architecture/app-remote-debug.md)）。这里只讲线上 H5。

---

## 2. 前置条件

| 端 | 要求 |
|---|---|
| 构建机 | 本仓库 + pnpm（`packageManager: pnpm@12.x`）；Node（H5 构建无平台差异） |
| 服务器 | nginx；静态目录（下文示例 `/srv/zukan/www`）；rsync / ssh 可达 |

配置占位符（按自己环境替换）：

| 占位符 | 示例 | 说明 |
|---|---|---|
| `EXAMPLE.COM` | `zukan.example.com` | 线上域名（配套 SSL 证书） |
| `server` | `ssh 配置的 Host 或 user@host` | rsync / ssh 目标 |
| `WWW_DIR` | `/srv/zukan/www` | 服务器上前端静态目录 |

---

## 3. 构建（构建机）

发布前先过门禁（AGENTS.md「改动后的门禁」全量）：

```bash
pnpm type-check                      # 必须 0 error
pnpm test                            # 必须全绿
pnpm lint && pnpm format:check
```

构建：

```bash
pnpm build:h5                        # = uni build
# 产物：dist/build/h5/
#   index.html                        # 引用绝对路径 /assets/*、/static/*
#   assets/*.js|css|…                 # 文件名带 contenthash，每次构建都会变
#   static/*                          # src/static 原样拷贝（favicon、styles、wasm…）
```

**生产同源（本手册部署形态）不要设置 `VITE_API_BASE_URL`**。前端请求层
（`src/services/http/request.ts` 等）对 `VITE_API_BASE_URL` 取 `?? ''`，缺省即同源
相对请求，正好打到同一域名下 nginx 分路由的 `/api/**`。只有前端与 API 真正跨域
（独立子域 / CDN）才需要设，那超出了本手册范围。

---

## 4. 上传（构建机 → 服务器）

```bash
rsync -a --delete dist/build/h5/  server:/srv/zukan/www/
```

- `--delete` 是安全的：`assets/`、`static/` 里的文件名都带 contenthash（或基本不变），
  `index.html` 指向新 hash，旧的 chunk 被清掉不会有人再引用。
- 单独文件微调可退化为 `rsync -a dist/build/h5/… 单文件`，但**至少 `index.html` 与对应
  新 assets 要一起上去**，避免新旧混着引用 404。

---

## 5. nginx：同域 vhost（前端 + 后端衔接）

后端手册 §4 给的反代示例在本手册的形态下合并进来——**同一 `server` block 同时
负责前端静态与后端反代**（后端手册示例是独立 server，二者取其一，别叠两套）。

```nginx
server {
    listen 443 ssl http2;
    server_name zukan.example.com;

    ssl_certificate     /etc/letsencrypt/live/zukan.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zukan.example.com/privkey.pem;

    root /srv/zukan/www;
    index index.html;

    # ── 前端静态 ────────────────────────────────────────────────
    # index.html 不缓存：每次发布后浏览器下次访问立即拿到新入口。
    # （js/css 文件名带 hash，缓存期届满或引用变化都会自然切换。）
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # 前端 hash 化资源：长缓存。注意正则命中后不再尝试其它匹配，
    # /assets/encrypted、/assets/battle 会先被下方更长的前缀 location 截走。
    location ~* \.(?:js|css|png|jpe?g|gif|webp|svg|ttf|woff2|wasm)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # SPA fallback：深层路由（pages.json 下的直接 URL 刷新）回落到 index.html，
    # 前端路由（无 Vue Router，uni 内置）接管渲染。
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ── 与 zukan-server 后端衔接 ────────────────────────────────
    # 加密资源直出：绕过 Rust 进程。同域前端取回属同源请求，无需 CORS 头；
    # 若将来有跨源消费方（CDN / 小程序），按后端手册 §4 补
    # add_header Access-Control-Allow-Origin "...";
    location /assets/encrypted/ {
        alias /srv/zukan/assets/encrypted-assets/;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # 对战使用率（明文、5 分钟缓存）：反代，应用已下发 max-age=300
    location /assets/battle/ {
        proxy_pass http://127.0.0.1:8080;
    }

    # 后端存活探针：明确反代，不能落到下方 SPA fallback（否则返回 index.html 假 200）
    location = /health {
        proxy_pass http://127.0.0.1:8080;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

要点：

- **nginx 前缀 vs 正则匹配顺序**：`location /assets/encrypted/`（前缀）匹配范围最长，
  会优先生效；正则 `~* \.(js|css|…)$` 只管其余（前端静态）。所以加密资源不会撞上前端的
  immutable 规则、后端原文分发。
- `/assets/battle/` 走反代（明文数据要经应用补头）；前端**不走**明文精灵图，`public/` 里
  的图片不必传给前端静态目录。
- `proxy_pass http://127.0.0.1:8080`（不带尾路径）保持原始 `/api/...` 路径不变。
- 改完 `nginx -t && systemctl reload nginx`（或所在发行版等价命令）。

> 换 `ZUKAN_DEK_VERSION`（后端 `docs/deployment.md` §8）会让前端缓存 key 前缀
> `fb:v{N}` 变化、客户端全量重拉，属**数据侧**更新手段，见
> [caching/overview.md](../caching/overview.md)；前端本体的发布不涉及它。

---

## 6. 上线验收 checklist（前端侧）

按顺序执行，全部通过再对外放流量（curl 用移动端 UA，避开按 UA 的降级逻辑）：

```bash
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
BASE=https://zukan.example.com

# 1) 首页 200，且 html 内容是最新构建（grep 一下 assets 文件名）
curl -fsS -o /dev/null -w '%{http_code}\n' -H "User-Agent: $UA" $BASE/

# 2) SPA fallback：深层路由直接访问 200
curl -fsS -o /dev/null -w '%{http_code}\n' -H "User-Agent: $UA" $BASE/pages/detail/detail

# 3) 入口 HTML 不被缓存，hash 静态资源 immutable
curl -sS -o /dev/null -D - -H "User-Agent: $UA"  $BASE/ | grep -i cache-control              # no-cache
curl -sS -o /dev/null -D - -H "User-Agent: $UA"  $BASE/assets/index-*.js | grep -i cache-control   # immutable

# 4) 后端探针（/health 已显式反代，不会被 SPA fallback 吞掉）
curl -fsS $BASE/health                          # → ok（见后端手册 §5）

# 5) 加密资源可取且是 ZKDX（直出生效）
curl -fsS $BASE/assets/encrypted/fb/gen-1.bin | head -c 4      # → ZKDX

# 6) DEK 下发（公开接口）——页面能渲染的前提
curl -fsS $BASE/api/v1/zukan/key                               # → {"dek":"<64 hex>","version":N,"algorithm":"AES-256-GCM"}
```

浏览器再确认一遍：页面能渲染出图鉴、精灵图能解密显示、登录 / 收藏可用。

> 后端完整验收（注册登录闭环、跨域预检等）见后端手册 §5，前端侧无需重复。

---

## 7. 日常更新路线图

| 变更 | 操作 | 重启？ |
|---|---|---|
| 只改前端代码 / 文案（H5） | 构建机 `pnpm build:h5` → rsync §4 →（必要时）`nginx -t && reload` | nginx reload 即可 |
| 改后端代码 / 迁移 / `.env` | 后端手册 §6，与前端发布互不影响 | 后端容器重建 |
| 更新图鉴数据 / 精灵图 | 后端手册 §6.2，前端零操作（数据全在远端） | 否 |
| **数据更新后老客户端看不到** | 递增 `ZUKAN_DEK_VERSION`（后端手册 §8） | 后端重启 |
| 前端 H5 回滚 | 构建机重新构建旧 commit + rsync（产物纯静态，换回旧 html+旧 hash 文件原位即可） | nginx reload |

---

## 相关文档

- 后端部署手册：`~/Code/zukan-server/docs/deployment.md`（§4 nginx 反代 / §5 验收 / §6 日常更新 / §8 DEK 与缓存版本）
- [架构总览](../architecture/overview.md) — 页面清单、环境变量 `VITE_API_BASE_URL` 语义
- [caching/overview.md](../caching/overview.md) — 缓存层级与「版本失效」速查