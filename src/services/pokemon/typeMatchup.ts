/**
 * 属性相克查询（纯函数）。
 *
 * 数据源 `src/core/data/typechart.ts`：`TypeChart[defSlug].damageTaken[atk]`
 * 为该防御属性受到某攻击属性时的档位——
 * `0`=普通(1×)、`1`=弱点(2×)、`2`=抵抗(0.5×)、`3`=免疫(0×)
 * （与 calc-engine 的 getTypeEffectiveness 同语义）。
 *
 * 注意 chart 的攻击属性键为首字母大写（'Fire'），且混有 'prankster'
 * （恶作剧之心）等非属性键——只遍历 18 个标准属性 slug。
 */
import { TypeChart } from '@/core/data/typechart';
import { ALL_TYPE_SLUGS } from '@/constants/pokemonTypes';

/** 0=普通 1=弱点(2×) 2=抵抗(0.5×) 3=免疫(0×) */
const NORMAL = 0;
const WEAK = 1;
const RESIST = 2;
const IMMUNE = 3;

export interface TypeMatchups {
    /** 2× 组（slug 列表） */
    weak: string[];
    /** 0.5× 组 */
    resist: string[];
    /** 0× 免疫组 */
    immune: string[];
}

const cap = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1);

function bucketize(valueOf: (other: string) => number): TypeMatchups {
    const out: TypeMatchups = { weak: [], resist: [], immune: [] };
    for (const slug of ALL_TYPE_SLUGS) {
        switch (valueOf(slug)) {
            case WEAK:
                out.weak.push(slug);
                break;
            case RESIST:
                out.resist.push(slug);
                break;
            case IMMUNE:
                out.immune.push(slug);
                break;
            case NORMAL:
            default:
                break;
        }
    }
    return out;
}

/**
 * 攻击视角：以 `slug` 属性的招式攻击 18 种防御属性时的分组。
 * weak = 该招 2× 的防御属性（打这些属性效果绝佳）。
 */
export function attackMatchups(slug: string): TypeMatchups {
    const atk = cap(slug.toLowerCase());
    return bucketize((def) => TypeChart[def]?.damageTaken[atk] ?? NORMAL);
}

/**
 * 防御视角：`slug` 单属性受到 18 种攻击属性时的分组。
 * weak = 克制该属性的攻击属性（被打 2×）；双属性倍率由详情页另行连乘。
 */
export function defenseMatchups(slug: string): TypeMatchups {
    const chart = TypeChart[slug.toLowerCase()];
    if (!chart) return { weak: [], resist: [], immune: [] };
    return bucketize((atk) => chart.damageTaken[cap(atk)] ?? NORMAL);
}
