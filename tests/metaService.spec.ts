/**
 * meta service 赛季路径用例（`src/services/meta/service.ts` + `battleDict.ts`）
 *
 * 路径约定：当前赛季（null / 空）走根路径 `/assets/battle/...`；
 * 历史赛季带 `${season}/` 段（如 `/assets/battle/M5/...`）。meta.json 始终在根。
 * mock fetchAssetJson 捕获实际请求路径，逐函数验证拼接。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ctrl = vi.hoisted<{ path: string; json: unknown }>(() => ({ path: '', json: {} }));

vi.mock('@/services/http', () => ({
    fetchAssetJson: async (path: string) => {
        ctrl.path = path;
        return ctrl.json as never;
    },
}));

import { ensureDict } from '@/services/meta/battleDict';
import { loadBattleMeta, loadLeaderboardSlugs, loadLinkMap, loadPokemonConfig } from '@/services/meta/service';

const leaderboard = { Singles: [{ id: 'salamence', rank: 1 }], Doubles: [] };

beforeEach(() => {
    ctrl.path = '';
    ctrl.json = leaderboard;
});

describe('loadBattleMeta', () => {
    it('meta.json 始终在根路径', async () => {
        ctrl.json = { game: 'g', season: 'M6', seasons: ['M6'], formats: [], generatedAt: 'g', dataVersion: 'v' };
        await loadBattleMeta();
        expect(ctrl.path).toBe('assets/battle/meta.json');
    });
});

describe('赛季路径拼接', () => {
    it('loadLeaderboardSlugs：当前赛季（null）→ 根路径', async () => {
        const slugs = await loadLeaderboardSlugs('singles', null);
        expect(ctrl.path).toBe('assets/battle/leaderboard.json');
        expect(slugs).toEqual(['salamence']);
    });

    it('loadLeaderboardSlugs：历史赛季 → 带赛季段', async () => {
        await loadLeaderboardSlugs('doubles', 'M5');
        expect(ctrl.path).toBe('assets/battle/M5/leaderboard.json');
    });

    it('loadLinkMap：历史赛季 → 带赛季段', async () => {
        ctrl.json = { salamence: { id: 373 } };
        await loadLinkMap('M4');
        expect(ctrl.path).toBe('assets/battle/M4/link.json');
    });

    it('loadPokemonConfig：当前赛季 → 根路径 p/', async () => {
        ctrl.json = { id: 'salamence', rank: 1, rows: {} };
        await loadPokemonConfig('singles', 'salamence', null);
        expect(ctrl.path).toBe('assets/battle/p/Singles/salamence.json');
    });

    it('loadPokemonConfig：历史赛季 → 带赛季段', async () => {
        ctrl.json = { id: 'salamence', rank: 1, rows: {} };
        await loadPokemonConfig('doubles', 'salamence', 'M3');
        expect(ctrl.path).toBe('assets/battle/M3/p/Doubles/salamence.json');
    });

    it('ensureDict：历史赛季 → 带赛季段', async () => {
        ctrl.json = {};
        await ensureDict('pokemon', 'M5');
        expect(ctrl.path).toBe('assets/battle/M5/i18n/pokemon.json');
    });

    it('ensureDict：当前赛季（null）→ 根路径', async () => {
        ctrl.json = {};
        await ensureDict('moves', null);
        expect(ctrl.path).toBe('assets/battle/i18n/moves.json');
    });
});
