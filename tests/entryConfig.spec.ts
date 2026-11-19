import { describe, expect, it } from 'vitest';
import {
    DATA_SECTIONS,
    ENTRY_REGISTRY,
    FEATURE_SECTIONS,
    resolveSections,
    type EntrySectionConfig,
} from '@/constants/entryConfig';

describe('entryConfig 注册表', () => {
    it('条目 key 全局唯一', () => {
        const keys = ENTRY_REGISTRY.map((e) => e.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('注册表每条都有 icon 与 url', () => {
        for (const entry of ENTRY_REGISTRY) {
            expect(entry.icon).toBeTruthy();
            expect(entry.url.startsWith('/pages/')).toBe(true);
        }
    });
});

describe('resolveSections 分区解析', () => {
    it('功能页单分区 · 7 条，顺序即配置', () => {
        const sections = resolveSections(FEATURE_SECTIONS);
        expect(sections).toHaveLength(1);
        expect(sections[0].rows.map((r) => r.key)).toEqual(
            FEATURE_SECTIONS[0].rows.slice(),
        );
        // 每条解析结果带全字段，供 ListRow 渲染
        const calc = sections[0].rows[0];
        expect(calc.titleKey).toBe('features.calc.title');
        expect(calc.meta).toBe('features.calc.meta');
    });

    it('资料页三分区 · 概览 6 + 对战数据 1 + 资讯 1', () => {
        const sections = resolveSections(DATA_SECTIONS);
        expect(sections.map((s) => s.key)).toEqual(['overview', 'battle', 'notice']);
        expect(sections[0].rows.map((r) => r.key)).toEqual(
            ['pokemon', 'types', 'moves', 'abilities', 'items', 'eggGroups'],
        );
        expect(sections[1].rows).toHaveLength(1);
        expect(sections[2].rows).toHaveLength(1);
    });

    it('公告条目被功能列表与资料页资讯分区同时引用（只定义一次）', () => {
        const feature = resolveSections(FEATURE_SECTIONS)[0].rows.map((r) => r.key);
        const data = resolveSections(DATA_SECTIONS)[2].rows.map((r) => r.key);
        expect(feature).toContain('notice');
        expect(data).toContain('notice');
        // 注册表里 notice 只此一份
        expect(ENTRY_REGISTRY.filter((e) => e.key === 'notice')).toHaveLength(1);
    });

    it('分区引用未知 key 时丢弃该行，不抛错', () => {
        // rows 类型层面已是 EntryKey 字面量联合（写错编译报错），
        // 运行时防御仍需覆盖（如老数据/外部下发），这里显式断言绕过类型。
        const sections = [
            { key: 'x', labelKey: 'x', rows: ['calc', '__unknown__', 'notice'] },
        ] as unknown as readonly EntrySectionConfig[];
        const resolved = resolveSections(sections);
        expect(resolved[0].rows.map((r) => r.key)).toEqual(['calc', 'notice']);
    });
});