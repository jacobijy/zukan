/**
 * 官方公告 API 客户端用例（`src/services/api/notices.ts`）
 *
 * stub uni.request 捕获 options，验证：
 * - 路径 /api/v1/notices 与 limit/offset query；
 * - 公开匿名（不带 Authorization）；
 * - snake_case → camelCase 转换、可选字段（link_rom/banner_url）缺省省略、
 *   脏条目过滤、items 非数组时降级空列表。
 */
import { beforeEach, expect, it, vi } from 'vitest';

interface Captured {
    url: string;
    method: string;
    header: Record<string, string>;
}
let captured: Captured | null = null;
let response: { statusCode: number; data: unknown } = { statusCode: 200, data: {} };

vi.stubGlobal('uni', {
    request(opts: Captured & { success: (r: { statusCode: number; data: unknown }) => void }) {
        captured = { url: opts.url, method: opts.method, header: opts.header };
        opts.success({ statusCode: response.statusCode, data: response.data });
    },
});

import { listNotices } from '@/services/api/notices';

const fullItem = {
    id: '9_1792033106_1788',
    kind: 2,
    kind2: 8,
    title: '赠送异色的“哲尔尼亚斯”！',
    is_important: false,
    link_rom: ['52'],
    url: 'https://resource.pokemon-home.com/webview/infomation/9Qb2z.html',
    start_at: 1794492000,
    updated_at: 1793957791,
    end_at: 1799333999,
    banner_url: 'https://resource.pokemon-home.com/webview/banner/9_.jpg',
};

beforeEach(() => {
    captured = null;
    response = { statusCode: 200, data: {} };
});

it('GET /notices 带 limit/offset，且不带鉴权头', async () => {
    response.data = { updated_at: 1794890746, total: 0, limit: 50, offset: 0, items: [] };
    await listNotices(50, 0);
    expect(captured!.method).toBe('GET');
    expect(captured!.url).toContain('/api/v1/notices?limit=50&offset=0');
    expect(captured!.header.Authorization).toBeUndefined();
});

it('snake_case 响应转成 camelCase 条目，可选字段保留', async () => {
    response.data = {
        updated_at: 1794890746,
        total: 2,
        limit: 50,
        offset: 0,
        items: [fullItem],
    };
    const list = await listNotices();
    expect(list.updatedAt).toBe(1794890746);
    expect(list.total).toBe(2);
    expect(list.items).toEqual([
        {
            id: fullItem.id,
            kind: 2,
            kind2: 8,
            title: fullItem.title,
            isImportant: false,
            linkRom: ['52'],
            url: fullItem.url,
            startAt: 1794492000,
            updatedAt: 1793957791,
            endAt: 1799333999,
            bannerUrl: fullItem.banner_url,
        },
    ]);
});

it('可选字段缺省时整个省略（不出现 undefined key）', async () => {
    response.data = {
        total: 1,
        items: [{ ...fullItem, link_rom: undefined, banner_url: undefined }],
    };
    const list = await listNotices();
    const item = list.items[0]!;
    expect(item).not.toHaveProperty('linkRom');
    expect(item).not.toHaveProperty('bannerUrl');
    expect(Object.keys(item).toSorted()).toEqual(
        ['endAt', 'id', 'isImportant', 'kind', 'kind2', 'startAt', 'title', 'updatedAt', 'url'].toSorted(),
    );
});

it('脏条目（必要字段缺失 / 类型不符）过滤掉', async () => {
    response.data = {
        total: 4,
        items: [
            fullItem,
            { ...fullItem, id: '' },
            { ...fullItem, url: 42 },
            { ...fullItem, is_important: 'yes' },
            { ...fullItem, start_at: null },
        ],
    };
    const list = await listNotices();
    expect(list.items).toHaveLength(1);
});

it('可选字段形状非法（如 link_rom 非字符串数组）丢弃整条', async () => {
    response.data = {
        total: 2,
        items: [fullItem, { ...fullItem, id: 'x', link_rom: '52' }],
    };
    const list = await listNotices();
    expect(list.items).toHaveLength(1);
    expect(list.items[0]!.id).toBe(fullItem.id);
});

it('items 不是数组时整体降级为空列表而非抛脏数据', async () => {
    response.data = { total: 0, items: null };
    const list = await listNotices();
    expect(list.items).toEqual([]);
    expect(list.total).toBe(0);
});

it('非 2xx 状态抛 RestRequestError', async () => {
    response = { statusCode: 404, data: { error: '资源不存在', code: 'NotFound' } };
    await expect(listNotices()).rejects.toMatchObject({ name: 'RestRequestError', statusCode: 404 });
});
