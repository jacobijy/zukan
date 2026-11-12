import { describe, expect, it } from 'vitest';
import { mergePlainBlocks, type ChunkedIndex } from '@/services/resources/resourceManager';

const base = (over: Partial<ChunkedIndex> = {}): ChunkedIndex => ({
    fid: 'PMOV',
    format: 1,
    plainLen: 6,
    blockSize: 256,
    blocks: [
        { n: 0, file: '0000.bin', off: 0, len: 4 },
        { n: 1, file: '0001.bin', off: 4, len: 2 },
    ],
    ...over,
});

describe('mergePlainBlocks', () => {
    it('按索引偏移合并多个块', () => {
        const idx = base();
        const merged = mergePlainBlocks(idx, [
            new Uint8Array([1, 2, 3, 4]),
            new Uint8Array([5, 6]),
        ]);
        expect([...merged]).toEqual([1, 2, 3, 4, 5, 6]);
        expect(merged.length).toBe(idx.plainLen);
    });

    it('块数不匹配时抛错', () => {
        expect(() => mergePlainBlocks(base(), [new Uint8Array([1])])).toThrow(/块数不匹配/);
    });

    it('块明文越界（索引损坏）时抛错', () => {
        const idx = base({ plainLen: 4 });
        expect(() =>
            mergePlainBlocks(idx, [
                new Uint8Array([1, 2, 3, 4]),
                new Uint8Array([5, 6]),
            ]),
        ).toThrow(/明文越界/);
    });

    it('非顺序索引（乱序 off）也能按 off 放置', () => {
        const idx = base({
            blocks: [
                { n: 1, file: '0001.bin', off: 4, len: 2 },
                { n: 0, file: '0000.bin', off: 0, len: 4 },
            ],
        });
        const merged = mergePlainBlocks(idx, [
            new Uint8Array([5, 6]),
            new Uint8Array([1, 2, 3, 4]),
        ]);
        expect([...merged]).toEqual([1, 2, 3, 4, 5, 6]);
    });
});