/**
 * 分享码编解码用例（services/share/share-code.ts）。
 *
 * 守的是「跨端可粘贴的字符串信封」：外观为无可读明文的 base64url（magic/版本/kind
 * 在内部二进制头）、往返一致、**不携带名称**（v2 body 直接是 payload，v1 信封兼容）、
 * 容忍聊天噪音、UTF-8（中文/emoji）、各层损坏映射到稳定 reason、payload 上限；
 * 解码结果仍要经各领域 normalizePayload 落地。
 */
import { describe, expect, it } from 'vitest';
import { SHARE_PAYLOAD_MAX_BYTES, ShareCodeError, decodeShareCode, encodeShareCode } from '@/services/share/share-code';
import { normalizePayload as normalizeTeam } from '@/services/teams/team-model';
import { normalizePayload as normalizeTemplate } from '@/services/templates/template-model';
import type { TeamPayload } from '@/services/teams/team-model';

function expectReason(fn: () => unknown, reason: string): void {
    try {
        fn();
    } catch (e) {
        expect(e).toBeInstanceOf(ShareCodeError);
        expect((e as ShareCodeError).reason).toBe(reason);
        return;
    }
    throw new Error(`expected ShareCodeError(${reason})`);
}

// 测试辅助：直接拼二进制头 + body 出码（绕过被测 encode，专造异常输入）
function rawCode(header: [number, number, number], body?: string | object): string {
    const bodyBuf =
        body === undefined
            ? Buffer.alloc(0)
            : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
    return Buffer.concat([Buffer.from(header), bodyBuf])
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

const MAGIC: [number, number] = [0x5a, 0x4b];
const TEAM_PAYLOAD: TeamPayload = {
    format: 'doubles',
    members: [
        {
            species_id: 6,
            form_id: 10094,
            ability_id: 65,
            item_id: 203,
            nature: 'bold',
            moves: [44, 3898, 240, 53],
            spread: { hp: 32, atk: 0, def: 14, spa: 0, spd: 0, spe: 20 },
        },
    ],
};

describe('encodeShareCode / decodeShareCode 往返', () => {
    it('队伍：外观为纯 base64url（无明文标记），kind / payload 全部还原', () => {
        const code = encodeShareCode('team', TEAM_PAYLOAD);
        expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(code).not.toContain(':');
        expect(code).not.toMatch(/team|tpl|ZUKAN/i);

        const decoded = decodeShareCode(code);
        expect(decoded.kind).toBe('team');
        expect(decoded.payload).toEqual(TEAM_PAYLOAD);
    });

    it('不携带名称：body 里没有 name 包裹层，解码也没有 name 字段', () => {
        const body = JSON.parse(Buffer.from(encodeShareCode('team', TEAM_PAYLOAD), 'base64url').slice(3).toString('utf8'));
        expect(body).toEqual(TEAM_PAYLOAD);
        expect(body).not.toHaveProperty('name');
        expect(decodeShareCode(encodeShareCode('team', TEAM_PAYLOAD))).not.toHaveProperty('name');
    });

    it('模板：kind=template 与 champions payload 往返', () => {
        const payload = {
            ruleset: 'champions',
            pokemon_id: 10035,
            nature: 3,
            moves: [226, 489],
            item: null,
            sp: { hp: 32, atk: 0, def: 0, spa: 32, spd: 0, spe: 2 },
        };
        const decoded = decodeShareCode(encodeShareCode('template', payload));
        expect(decoded.kind).toBe('template');
        expect(decoded.payload).toEqual(payload);
    });

    it('UTF-8：多字节中文 + emoji（4 字节码点）payload 字段往返', () => {
        const payload = { format: 'singles', members: [], note: '冠军🏆队 チーム😀' };
        const decoded = decodeShareCode(encodeShareCode('team', payload));
        expect(decoded.payload).toEqual(payload);
    });

    it('v1 历史信封兼容：取 payload，忽略其中的 name', () => {
        const legacy = rawCode([...MAGIC, 0x10] as [number, number, number], {
            name: '老名字',
            payload: TEAM_PAYLOAD,
        });
        const decoded = decodeShareCode(legacy);
        expect(decoded.kind).toBe('team');
        expect(decoded.payload).toEqual(TEAM_PAYLOAD);
    });
});

describe('decodeShareCode 输入容错', () => {
    const code = encodeShareCode('team', { format: 'singles', members: [] });

    it('容忍前后聊天噪音，提取首个命中的码', () => {
        const decoded = decodeShareCode(`求指教！这是我的队伍：\n${code}\n厉害吧`);
        expect(decoded.kind).toBe('team');
        expect(decoded.payload).toEqual({ format: 'singles', members: [] });
    });

    it('前面有任意长 base64 垃圾串时仍能找到后面的真码', () => {
        const junk = Buffer.alloc(24, 0x11).toString('base64').replace(/=+$/, '');
        const decoded = decodeShareCode(`${junk}\n${code}`);
        expect(decoded.kind).toBe('team');
    });

    it('空串 / 无关文本 / 非字符串 / 短串 → no-code', () => {
        expectReason(() => decodeShareCode(''), 'no-code');
        expectReason(() => decodeShareCode('hello world'), 'no-code');
        expectReason(() => decodeShareCode(undefined as unknown as string), 'no-code');
        expectReason(() => decodeShareCode('AAAAAAAAAAAAAAAA'), 'no-code'); // 长但 magic 不对
    });

    it('旧明文格式（ZUKAN1:team:…，base64 内容是裸信封）不再识别 → no-code', () => {
        const oldBody = Buffer.from(JSON.stringify({ name: 'x', payload: { format: 'singles', members: [] } }), 'utf8')
            .toString('base64')
            .replace(/=+$/, '');
        expectReason(() => decodeShareCode(`ZUKAN1:team:${oldBody}`), 'no-code');
    });

    it('版本不支持（高 4 位 = 3）→ bad-version', () => {
        const v3 = rawCode([...MAGIC, 0x30] as [number, number, number], { format: 'singles', members: [] });
        expectReason(() => decodeShareCode(v3), 'bad-version');
    });

    it('版本 0 → bad-version（视为不支持的异常版本）', () => {
        const v0 = rawCode([...MAGIC, 0x00] as [number, number, number], { format: 'singles', members: [] });
        expectReason(() => decodeShareCode(v0), 'bad-version');
    });

    it('kind 位非法（低 4 位 = 2）→ bad-encoding', () => {
        const badKind = rawCode([...MAGIC, 0x12] as [number, number, number], { format: 'singles', members: [] });
        expectReason(() => decodeShareCode(badKind), 'bad-encoding');
    });

    it('base64 长度 %4===1（够长的候选）→ 跳过该候选 → no-code', () => {
        expectReason(() => decodeShareCode('A'.repeat(17)), 'no-code');
    });

    it('magic 命中但 JSON 损坏 → bad-encoding', () => {
        const broken = rawCode([...MAGIC, 0x20] as [number, number, number], `{${'x'.repeat(20)}`);
        expectReason(() => decodeShareCode(broken), 'bad-encoding');
    });

    it('body 非对象 / v1 信封 payload 非对象或缺位 → bad-envelope', () => {
        // v2 裸 payload 不是对象（数组 / 原始值）；注意码长要过 16 字符候选阈值
        expectReason(
            () => decodeShareCode(encodeShareCode('team', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as unknown as object)),
            'bad-envelope',
        );
        expectReason(
            () => decodeShareCode(rawCode([...MAGIC, 0x20] as [number, number, number], '"not-an-object"')),
            'bad-envelope',
        );
        // v1 信封结构损坏
        expectReason(
            () => decodeShareCode(rawCode([...MAGIC, 0x10] as [number, number, number], { name: 'x', payload: 'no' })),
            'bad-envelope',
        );
        expectReason(
            () => decodeShareCode(rawCode([...MAGIC, 0x10] as [number, number, number], { name: 'x' })),
            'bad-envelope',
        );
        expectReason(
            () => decodeShareCode(rawCode([...MAGIC, 0x10] as [number, number, number], [1, 2, 3, 4, 5])),
            'bad-envelope',
        );
    });
});

describe('decode 结果接领域 normalize', () => {
    it('队伍：越界 SP / 超量成员 / 非法 nature 安全落地', () => {
        const dirty = {
            format: 'weird',
            members: [
                {
                    species_id: 25,
                    nature: 'not-a-nature',
                    moves: [1, 1, 2],
                    spread: { hp: 99, atk: -1, def: 1.5, spa: 0, spd: 0, spe: 0 },
                },
                { species_id: 'bad' },
            ],
            futureField: { keep: true },
        };
        const decoded = decodeShareCode(encodeShareCode('team', dirty as unknown as object));
        const team = normalizeTeam(decoded.payload);
        expect(team.format).toBe('singles');
        expect(team.members).toHaveLength(1);
        expect(team.members[0].moves).toEqual([1, 2]);
        expect(team.members[0].spread.hp).toBe(32);
        expect(team.members[0].nature).toBe('serious');
        expect((team as unknown as Record<string, unknown>).futureField).toEqual({ keep: true });
    });

    it('模板：缺 pokemon_id 的 payload normalize 为 null（调用方判无效码）', () => {
        const decoded = decodeShareCode(
            encodeShareCode('template', { ruleset: 'standard', pokemon_id: 0 } as object),
        );
        expect(normalizeTemplate(decoded.payload)).toBeNull();
    });
});

describe('encodeShareCode 上限', () => {
    it('payload JSON 超 32 KiB → payload-too-large', () => {
        const big = { blob: 'a'.repeat(SHARE_PAYLOAD_MAX_BYTES + 10) };
        expectReason(() => encodeShareCode('team', big), 'payload-too-large');
    });
});
