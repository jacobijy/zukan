/**
 * 「官方公告」编排：公告列表 → 过滤展示期 → 可直接渲染的条目。
 *
 * 公告接口是明文公开 JSON，快照随服务端部署更新（以天为单位变化），
 * 做会话级 Promise 缓存；请求失败清掉缓存，下次调用可重试。
 *
 * `id` 跨抓取周期可能变化，只做会话内 key，不持久化（协议见
 * docs/features/notices.md）。
 */
import { noticesApi } from '@/services/api';

export interface NoticeEntry {
    id: string;
    /** 分类一：1=HOME 本体、2=关联作品、3=其他（对应 App 大 tab） */
    kind: number;
    /** 分类二（更细标签）：3=维护、4=更新、7=公告、8=其他作品、9=其他、10=问卷 */
    kind2: number;
    title: string;
    isImportant: boolean;
    /** 关联作品编号（字符串编码）；未知编号展示端忽略 */
    linkRom?: string[];
    /** 官方详情页 webview 地址，点击卡片打开 */
    url: string;
    /** 更新时间（Unix 秒），列表按它降序、行内展示日期 */
    updatedAt: number;
    /** 横幅图地址；无横幅的条目省略 */
    bannerUrl?: string;
}

let cache: Promise<NoticeEntry[]> | null = null;

/** 是否还在展示期内（快照可能含已过期条目）。startAt/endAt 是 Unix 秒 */
const isLive = (n: { startAt: number; endAt: number }): boolean => {
    const nowSec = Date.now() / 1000;
    return nowSec >= n.startAt && nowSec <= n.endAt;
};

/**
 * 清会话缓存。仅测试 / 登出类场景使用；公告按会话拉一次即可。
 */
export function clearNoticesCache(): void {
    cache = null;
}

/**
 * 拉取公告（limit=200 覆盖快照全量，列表端再按需分 tab / 分页展示）。
 * 网络失败向上抛（缓存已清理，可重试），由 UI 决定回落。
 */
export function loadNotices(): Promise<NoticeEntry[]> {
    if (cache) return cache;
    cache = noticesApi.listNotices(200).then((res) =>
        res.items.filter(isLive).map((n) => ({
            id: n.id,
            kind: n.kind,
            kind2: n.kind2,
            title: n.title,
            isImportant: n.isImportant,
            ...(n.linkRom !== undefined ? { linkRom: n.linkRom } : {}),
            url: n.url,
            updatedAt: n.updatedAt,
            ...(n.bannerUrl !== undefined ? { bannerUrl: n.bannerUrl } : {}),
        })),
    );
    // 失败清缓存，下次调用可重试
    cache.catch(() => {
        cache = null;
    });
    return cache;
}
