# 官方公告页（资料中心「资讯」栏目）

资料中心「资讯」分区 → 「官方公告」进入公告列表页 `pages/notices/notices`。
数据是**明文公开 JSON**（不加密、不鉴权、不入库），协议权威见
[notices.md](notices.md)（API 契约），后端快照链路见 zukan-server 仓
`tools/homedata/README.md`「公告（Notice）已破解」。

## 页面与组件

排版对齐 Pokémon HOME App 公告页：**顶部四分组 tab（下划线高亮）→ 卡片流**，
每张卡片 = 彩色头部条（分类名 + 右上角关联作品小图标）+ 白卡正文
（标题 → banner（底部渐变遮罩叠「点击查看官方详情」）→ 右下 YYYY/MM/DD 日期），
重要公告左上角探出红色感叹号圆徽。

- **列表页** `pages/notices/notices.vue`：DetailNavbar + 非虚拟化列表
  （快照量级几十条）。tab 行 `.notice-tabs` 等宽四项 + 激活下划线
  （`::after` 骑在容器底线上），点击按 `kind` 过滤（0=全部/1=HOME/2=关联作品/3=其他）。
  - `isImportant=true` 置顶（服务端已按 updated_at 降序，前端稳定排序只翻重要位）。
  - 行组件 `components/notices/NoticeRow.vue`：头部条 `notice-card__header`
    （`kind2` 标签白字，当前统一青绿 `#63c1b4`；`isImportant` 时左内边距让出感叹号位；
    卡片本体不 `overflow:hidden`，感叹号才探得出边框，上圆角由头部条自担）。
    banner 加载失败只藏说明遮罩（`bannerFailed`，按条目 id 重置）。
  - 点行 → 官方详情页 `url`：**H5 `window.open` 外跳；非 H5（小程序/App）降级为
    复制链接 + toast**（uni-app 无统一外链打开 API）。
- **作品小图标** `constants/noticeRoms.ts::NOTICE_ROM_ICONS`：`link_rom` 是 HOME
  内部 rom 序号（**不是** PokeTitle 图集的 101–111 编号体系），实测归纳映射：
  `34`=GO、`44/45`=剑/盾、`47`=阿尔宙斯、`48/49`=晶灿钻石/明亮珍珠、
  `50/51`=朱/紫、`52`=传说 Z-A、`53`=Champions；未登记编号忽略。
  图标复用 `static/img/software-icons/`（**不走加密**，同 software-icons 口径）。
- **服务编排** `services/notices/notices.ts`：`loadNotices()` 会话级 Promise 缓存
  （与 popularity.ts 同模式），`limit=200` 拉快照全量，**按 endAt 过滤过期条目**
  （注意 startAt/endAt 是 Unix **秒**，与 Date.now() 毫秒比较要 /1000）；
  失败清缓存可重试；`clearNoticesCache()` 供测试。`id` 跨抓取周期可能变化，
  只做会话内 key，不持久化。
- **API 客户端** `services/api/notices.ts`：`listNotices(limit, offset)`，
  snake_case → camelCase，脏条目过滤，`link_rom`/`banner_url` 可选字段缺省省略
  （后端 skip_serializing_if）。测试 `tests/noticesApi.spec.ts`、
  `tests/noticesService.spec.ts`。

## 入口与图标

公告入口卡由 `src/constants/entryConfig.ts` 的注册表条目 `notice` 定义一份，被两处
分区引用：资料页 `data.vue`「资讯」分区（`DATA_SECTIONS`）+ 功能 tab `features.vue`
列表尾（`FEATURE_SECTIONS`，文案同用 `data.notice`/`data.noticeDesc`）。两页入口
布局只改 `entryConfig.ts` 即可（增删条目、挪分区、调顺序），图标统一 `data-notice` =
`static/img/hub-icons/notice.png`（3D 炫彩套，源图 `tmp/notice.png` 1254px 缩到
144px 母版）。

## 降级语义

- 网络失败 / 快照缺失（404）→ 空态 + console.warn，不重试轮询（快照按天变化）。
- `kind2` 未知值 → 标签回落「公告」（空标签破坏头部条布局）。
- banner 加载失败 → 只藏说明遮罩，图自然空（快照 URL 由官方控制，可能过期）。
