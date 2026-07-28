/**
 * PokemonGenBundle → IPokemonBaseModel[] 映射
 *
 * 解码后的 bundle 由五张并行表组成（`baseEntries` / `statEntries` /
 * `typeEntries` / `abilityEntries` / `eggGroupEntries`），按 `id` join
 * 组成 UI 消费的宝可梦模型。
 *
 * ## 已知限制
 * - bundle **没有名字 / 描述 / 图片文件名** —— 使用占位符
 *   （名字随后由 i18n bundle 补齐，图片走 `EncryptedSprite` 独立通道）
 * - Ability 只有数字 id —— 暂用 `String(id)` 占位
 */
import { resourceManager } from '@/services/resourceManager';
import { typeStrs } from '@/utils/helpers';
import type { PokemonGenBundle } from '@/infra/wasm';

const HP = 'HP';
const ATK = '攻击';
const DEF = '防御';
const SPA = '特攻';
const SPD = '特防';
const SPE = '速度';

function typeName(id: number): string | null {
  return id ? typeStrs[id] ?? null : null;
}

export function mergeBundleToModel(bundle: PokemonGenBundle): IPokemonBaseModel[] {
  const statById = new Map(bundle.statEntries.map(s => [s.id, s]));
  const typeById = new Map(bundle.typeEntries.map(t => [t.id, t]));
  const abilityById = new Map(bundle.abilityEntries.map(a => [a.id, a]));

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
      if (a.ability1Id) abilities.push(String(a.ability1Id));
      if (a.ability2Id) abilities.push(String(a.ability2Id));
    }
    const hiddenAbility = a?.abilityHiddenId ? String(a.abilityHiddenId) : '';

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

    return {
      id: b.id,
      // TODO(i18n): 用 i18n bundle 里的物种名替换
      name: `pokemon-${b.id}`,
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
 * 拉指定世代的宝可梦列表。缓存命中时 `resourceManager` 内部直接返回，
 * 首次访问才实际网络下载 + 解密 + 解码。
 */
export async function fetchPokemonList(genId: number): Promise<IPokemonBaseModel[]> {
  const bundle = await resourceManager.getPokemonGen(genId);
  return mergeBundleToModel(bundle);
}
