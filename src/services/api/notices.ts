/**
 * 官方公告 API 客户端（**公开匿名**，无需 token）。
 *
 * 端点（`/api/v1` 前缀由 rest 统一补）：
 * - GET /notices?limit=&offset=  公告列表（updated_at 降序）
 * - GET /notices/:id            单条公告（当前前端未使用）
 *
 * 数据来自 Pokémon HOME 公告页的构建期快照，随服务端部署更新，非实时。
 * 协议权威见 docs/features/notices.md。
 */

import { rest } from '@/services/http';

export interface NoticeItem {
    /** HOME 公告 ID（`<语言>_<时间戳>_<序号>`），跨抓取周期可能变化，勿持久化 */
    id: string;
    /** 分类一：1=HOME 本体、2=关联作品、3=其他 */
    kind: number;
    /** 分类二（tab 内标签）：3=维护、4=更新、7=公告、8=其他作品、9=其他、10=问卷 */
    kind2: number;
    title: string;
    isImportant: boolean;
    /** 关联作品编号（HOME 作品编号字符串，如 "52"=传说 Z-A）；无则省略 */
    linkRom?: string[];
    /** 官方详情页（公开 webview HTML），免鉴权直接打开 */
    url: string;
    /** 展示起止（Unix 秒）；快照可能含已过期条目，客户端按 endAt 过滤 */
    startAt: number;
    updatedAt: number;
    endAt: number;
    /** 横幅图（公开 CDN）；无横幅的条目省略 */
    bannerUrl?: string;
}

export interface NoticeList {
    /** 快照时间（Unix 秒）：全部条目 updatedAt 的最大值 */
    updatedAt: number;
    /** 快照内条目总数 */
    total: number;
    /** 本次生效的分页参数（回显） */
    limit: number;
    offset: number;
    items: NoticeItem[];
}

interface RawItem {
    id?: unknown;
    kind?: unknown;
    kind2?: unknown;
    title?: unknown;
    is_important?: unknown;
    link_rom?: unknown;
    url?: unknown;
    start_at?: unknown;
    updated_at?: unknown;
    end_at?: unknown;
    banner_url?: unknown;
}

interface RawList {
    updated_at?: unknown;
    total?: unknown;
    limit?: unknown;
    offset?: unknown;
    items?: unknown;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(isString);

/**
 * 单条脏数据（必要字段缺失 / 类型不符）降级为 null，由调用方过滤。
 * `link_rom` / `banner_url` 是可选字段（后端 skip_serializing_if），
 * 缺省即省略，只在存在但形状非法时丢弃整条（防御未来契约变动）。
 */
const toItem = (raw: RawItem): NoticeItem | null => {
    const { id, kind, kind2, title, is_important, link_rom, url, start_at, updated_at, end_at, banner_url } = raw;
    if (
        isString(id) &&
        isFiniteNumber(kind) &&
        isFiniteNumber(kind2) &&
        isString(title) &&
        typeof is_important === 'boolean' &&
        isString(url) &&
        isFiniteNumber(start_at) &&
        isFiniteNumber(updated_at) &&
        isFiniteNumber(end_at)
    ) {
        if (link_rom !== undefined && !isStringArray(link_rom)) return null;
        if (banner_url !== undefined && !isString(banner_url)) return null;
        return {
            id,
            kind,
            kind2,
            title,
            isImportant: is_important,
            ...(link_rom !== undefined ? { linkRom: link_rom } : {}),
            url,
            startAt: start_at,
            updatedAt: updated_at,
            endAt: end_at,
            ...(banner_url !== undefined ? { bannerUrl: banner_url } : {}),
        };
    }
    return null;
};

/**
 * 拉取公告列表一页。limit/offset 越界由服务端判 400 INVALID_INPUT；
 * 响应整体形状异常（items 不是数组）时降级为空列表，不抛脏数据进 UI。
 */
export async function listNotices(limit = 50, offset = 0): Promise<NoticeList> {
    const q = `limit=${limit}&offset=${offset}`;
    const res = await rest.get<RawList>(`/notices?${q}`);
    const rawItems = Array.isArray(res?.items) ? (res.items as RawItem[]) : [];
    return {
        updatedAt: isFiniteNumber(res?.updated_at) ? res.updated_at : 0,
        total: isFiniteNumber(res?.total) ? res.total : rawItems.length,
        limit: isFiniteNumber(res?.limit) ? res.limit : limit,
        offset: isFiniteNumber(res?.offset) ? res.offset : offset,
        items: rawItems.map(toItem).filter((x): x is NoticeItem => x !== null),
    };
}
