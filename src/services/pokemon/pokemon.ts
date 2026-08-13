/**
 * PokemonGenBundle → IPokemonBaseModel[] 映射
 *
 * 解码后的 bundle 由五张并行表组成（`baseEntries` / `statEntries` /
 * `typeEntries` / `abilityEntries` / `eggGroupEntries`），按 `id` join
 * 组成 UI 消费的宝可梦模型。
 *
 * 名称来自 i18n 名称组 bundle（PKNM），通过 `NameResolvers` 注入：
 * i18n 未就绪时传 null，退回占位符；i18n 加载完成后 store 会重映射一次。
 * Ability 在 i18n 表中是 ability_id；这里用解析器查名，查不到回落数字。
 * 图片走 `EncryptedSprite` 独立通道。
 */
import { resourceManager } from '@/services/resources/resourceManager';
import { typeStrs } from '@/utils/helpers';
import { GENERATIONS } from '@/constants/generations';
import { useI18nStore } from '@/store/i18n';
import type { PokemonGenBundle } from '@/infra/wasm';

const HP = 'HP';
const ATK = '攻击';
const DEF = '防御';
const SPA = '特攻';
const SPD = '特防';
const SPE = '速度';

function typeName(id: number): string | null {
    return id ? (typeStrs[id] ?? null) : null;
}

/** i18n 名称解析器；未就绪时各字段为 null，merge 逻辑自行回落 */
interface NameResolvers {
    species: (speciesId: number) => string | null;
    form: (formId: number) => string | null;
    ability: (abilityId: number) => string | null;
}

function mergeBundleToModel(bundle: PokemonGenBundle, names: NameResolvers | null): IPokemonBaseModel[] {
    const statById = new Map(bundle.statEntries.map((s) => [s.id, s]));
    const typeById = new Map(bundle.typeEntries.map((t) => [t.id, t]));
    const abilityById = new Map(bundle.abilityEntries.map((a) => [a.id, a]));

    const resolveAbility = (id: number): string =>
        names?.ability(id) ?? String(id);

    return bundle.baseEntries.map((b): IPokemonBaseModel => {
        const s = statById.get(b.id);
        const t = typeById.get(b.id);
        const a = abilityById.get(b.id);

        const types: string[] = [];
        if (t) {
            const t1 = typeName(t.type1Id);
            if (t1) types.push(t1);
            const t2 = typeName(t.type2Id);
            if (t2) types.push(t2);
        }

        const abilities: string[] = [];
        if (a) {
            if (a.ability1Id) abilities.push(resolveAbility(a.ability1Id));
            if (a.ability2Id) abilities.push(resolveAbility(a.ability2Id));
        }
        const hiddenAbility = a?.abilityHiddenId ? resolveAbility(a.abilityHiddenId) : '';

        const stats: { name: string; value: number }[] = s
            ? [
                  { name: HP, value: s.hp },
                  { name: ATK, value: s.attack },
                  { name: DEF, value: s.defense },
                  { name: SPA, value: s.specialAttack },
                  { name: SPD, value: s.specialDefense },
                  { name: SPE, value: s.speed },
              ]
            : [];

        // 物种名：i18n 未就绪时回落 `pokemon-<id>` 占位
        const name = names?.species(b.speciesId) ?? `pokemon-${b.id}`;
        // 形态名：默认形态无标签；非默认形态查 i18n，未就绪回落 form-<id>
        const formLabel = b.isDefault ? '' : (names?.form(b.id) ?? `form-${b.id}`);

        return {
            id: b.id,
            speciesId: b.speciesId,
            isDefault: b.isDefault,
            formLabel,
            name,
            types,
            abilities,
            hiddenAbility,
            image: '/static/default.png',
            stats,
            description: '',
            moves: [],
            evolutionChain: [],
            height: b.height,
            weight: b.weight,
        };
    });
}

/**
 * 根据宝可梦全国编号推算所属世代。
 * 号段来自 `@/constants/generations` 单一数据源 —— 这里曾复制过一份
 * if-else 阶梯，与常量表各自漂移（gen9 两边都写成 1010）。
 * 未匹配返回 `null`（无效 id 或未来世代）。
 */
export function genForPokemonId(id: number): number | null {
    if (id <= 0) return null;
    const gen = GENERATIONS.find((g) => id >= g.start && id <= g.end);
    if (!gen) return null;
    // 'gen9' → 9
    const n = Number.parseInt(gen.value.replace('gen', ''), 10);
    return Number.isFinite(n) ? n : null;
}

/**
 * 从 i18n store 构造名称解析器。
 * store 未就绪（首次启动名称尚未加载）或无 active pinia（单测）时返回 null，
 * merge 逻辑回落占位符；名称就绪后 store 会触发重映射。
 */
function resolveNames(): NameResolvers | null {
    try {
        const i18n = useI18nStore();
        if (!i18n.ready) return null;
        return {
            species: (id) => i18n.speciesName(id),
            form: (id) => i18n.formLabel(id),
            ability: (id) => i18n.abilityName(id),
        };
    } catch {
        return null;
    }
}

/**
 * 拉指定世代的宝可梦列表。缓存命中时 `resourceManager` 内部直接返回，
 * 首次访问才实际网络下载 + 解密 + 解码。
 */
export async function fetchPokemonList(genId: number): Promise<IPokemonBaseModel[]> {
    const bundle = await resourceManager.getPokemonGen(genId);
    return mergeBundleToModel(bundle, resolveNames());
}
