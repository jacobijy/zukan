# 文档索引

按主题分类。改代码前先读对应文档；改完代码同步更新对应文档。

| 分类 | 文档 | 讲什么 |
|------|------|--------|
| 架构 | [architecture/overview.md](architecture/overview.md) | 目录分层、数据流向、命名约定、循环依赖防护 |
| 架构 | [architecture/testing.md](architecture/testing.md) | vitest 约定、测试数据盲区、门禁命令 |
| 架构 | [architecture/mp-weixin-build.md](architecture/mp-weixin-build.md) | 微信小程序构建：条件编译、WASM 包内加载（copy-wasm）、产物 s/l 瘦身（slim）、2MB 主包与发布 checklist |
| 架构 | [architecture/mp-weixin-remote-debug.md](architecture/mp-weixin-remote-debug.md) | 远程 Linux 编辑 + 另一台 Mac/Windows 跑开发者工具的调试流：watch 构建 + Mutagen/rsync 同步 dev 产物 + 工具设置与排障 |
| 架构 | [architecture/app-remote-debug.md](architecture/app-remote-debug.md) | Android/iOS 调试流：Linux `build:app` 出本地打包资源（vite.config 内联动态 import）+ Mutagen/rsync 同步 + 对端 App 离线 SDK 工程（AS/Xcode）编译运行；版本/appid 对齐与 wasm 真机验证 |
| UI | [ui/component-conventions.md](ui/component-conventions.md) | 先建组件再写页面、目录划分、scoped CSS 陷阱、`<script setup>` 单例陷阱 |
| UI | [ui/virtual-list.md](ui/virtual-list.md) | VirtualGrid 定高虚拟化的耦合与改动注意 |
| UI | [ui/software-icons.md](ui/software-icons.md) | HOME 作品版本徽章（世代切换用）：22 枚 128px 透明 PNG 静态资源、文件→游戏→世代映射、引用方式，不走加密 |
| UI | [ui/type-icons.md](ui/type-icons.md) | HOME 属性贴纸：type_NN 编号=标准 type id（01–18；19–36 为未用变体）、`typeIconPath`、白底圆形 TypeBadgeIcon vs 文字 TypeBadge，不走加密 |
| 数据 | [data/bundle-decode.md](data/bundle-decode.md) | FlatBuffers bundle 清单、五表 join、`hasSprite` 资源标记、EVO1 进化树、三套 id 空间与 form 重映射 |
| 数据 | [data/filtering-sort.md](data/filtering-sort.md) | 图鉴筛选/排序、收藏、世代快照语义 |
| 多语言 | [i18n/i18n-bundle.md](i18n/i18n-bundle.md) | names/flavor 两类 bundle、UI 语言与内容语言、回落策略 |
| 功能 | [features/calc-engine.md](features/calc-engine.md) | 伤害计算器数据流、slug→id、招式 flags、WASM 硬编码 |
| 功能 | [features/archive.md](features/archive.md) | 资料中心属性/招式/特性/道具图鉴：列表虚拟化、反查索引、flavor 多表、道具图标 manifest |
| 加密 | [security/encryption-pipeline.md](security/encryption-pipeline.md) | ZKDX 格式、后端构建分发、前端解密、version 字节双身份、variant 体积对照与回落链、排障（含 dev-only 资源探测器） |
| 加密 | [security/auth-session.md](security/auth-session.md) | DEK 唯一入口、401 恢复决策树、登录弹层去重 |
| 缓存 | [caching/resource-cache.md](caching/resource-cache.md) | resourceManager 三层缓存、inflight 去重、版本失效 |
| 缓存 | [caching/sprite-cache.md](caching/sprite-cache.md) | 加密图片（sprite + 道具图标）：imageCache 三条调度不变量 + imagePersist 四条持久化不变量 + 渐进式两段加载 + 回落落点的按版本记录 |

> 历史文档保留在 [`archive/`](archive/)，不再维护。包括早期加密方案稿、解密流程稿、
> 旧架构图、REST/encrypted-assets 归档稿等。需要追溯「当初为什么这么设计」时再翻。
