/**
 * 官方公告编排用例（`src/services/notices/notices.ts`）
 *
 * mock 公告 API，验证：
 * - 过期条目按 endAt 过滤（快照可能含已过期条目）；
 * - 可选字段（linkRom/bannerUrl）透传与省略；
 * - 会话级缓存：重复调用只拉一次接口；失败清缓存可重试。
 */
import { beforeEach, expect, it, vi } from 'vitest';

const ctrl = vi.hoisted(() => ({
    items: [] as unknown[],
    fail: false,
}));

vi.mock('@/services/api', () => ({
    noticesApi: {
        listNotices: vi.fn(async () => {
            if (ctrl.fail) throw new Error('network');
            return {
                updatedAt: 1794890746,
                total: ctrl.items.length,
                limit: 200,
                offset: 0,
                items: ctrl.items,
            };
        }),
    },
}));

import { clearNoticesCache, loadNotices } from '@/services/notices/notices';
import { noticesApi } from '@/services/api';

// 未来时间戳：任意「现在」都在展示期内
const DAY = 86_400;
const live = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    kind: 2,
    kind2: 8,
    title: `公告 ${id}`,
    isImportant: false,
    url: `https://resource.pokemon-home.com/webview/${id}.html`,
    startAt: 1794890746 - DAY,
    updatedAt: 1794890746,
    endAt: 1794890746 + DAY,
    ...extra,
});

beforeEach(() => {
    // 用系统时钟对齐快照字段（live() 用 1794890746±DAY，把 now 固定在其间）
    vi.useFakeTimers({ now: 1794890746 * 1000 });
    clearNoticesCache();
    ctrl.items = [];
    ctrl.fail = false;
    vi.mocked(noticesApi.listNotices).mockClear();
});

it('过滤已过期条目，live 条目透传全字段', async () => {
    ctrl.items = [
        live('a', { isImportant: true, linkRom: ['52'], bannerUrl: 'https://x/b.jpg' }),
        live('b', { startAt: 1794890746 - 3 * DAY, endAt: 1794890746 - DAY }),
        live('c', { startAt: 1794890746 + DAY }),
    ];
    const entries = await loadNotices();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
        id: 'a',
        kind: 2,
        kind2: 8,
        title: '公告 a',
        isImportant: true,
        linkRom: ['52'],
        url: 'https://resource.pokemon-home.com/webview/a.html',
        updatedAt: 1794890746,
        bannerUrl: 'https://x/b.jpg',
    });
});

it('可选字段缺省时整个省略', async () => {
    ctrl.items = [live('a', { linkRom: undefined, bannerUrl: undefined })];
    const entries = await loadNotices();
    expect(entries[0]).not.toHaveProperty('linkRom');
    expect(entries[0]).not.toHaveProperty('bannerUrl');
});

it('会话级缓存：重复调用只拉一次接口', async () => {
    ctrl.items = [live('a')];
    await loadNotices();
    await loadNotices();
    expect(noticesApi.listNotices).toHaveBeenCalledTimes(1);
});

it('失败清缓存：下次调用重试', async () => {
    ctrl.fail = true;
    await expect(loadNotices()).rejects.toThrow('network');
    ctrl.fail = false;
    ctrl.items = [live('a')];
    const entries = await loadNotices();
    expect(entries).toHaveLength(1);
    expect(noticesApi.listNotices).toHaveBeenCalledTimes(2);
});
