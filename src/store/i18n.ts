/**
 * 多语言文本 store。
 *
 * 语言拆成两套独立设置：
 * - `contentLang`：宝可梦游戏数据名称（物种/招式/特性），从加密 bundle 加载；
 * - `uiLang`：界面静态文案（vue-i18n）。
 *
 * `currentLang` 是 `contentLang` 解析后的实际 bundle 语言（`'auto'` 按系统），
 * 名称查找、加载与回落都围绕它。
 *
 * 描述组按**族 × id 档位分片**（`flavor/<family>-sNN.bin`），不随名称预取：
 * 由 `ensureFlavorEntry(family, id)` 按实体 id 算片号、逐片拉取并累积合并进
 * `flavor` 查找表（片到达即整体替换引用触发响应式）。访问器
 * `speciesFlavorText(id)` 等签名不变，组件只改 ensure 调用。
 *
 * ## 回落策略
 * 首选语言可能部分或整体缺失（ja-roma 仅有物种名；cs/pt-br 全空），
 * 因此总是先加载英文基线，再用首选语言条目逐表逐 id 覆盖（见 `overlay`）。
 * 描述组的语言级回落见 `flavor.ts` 的 `resolveFlavorLang`（静态名单），
 * 个别 id 缺失返回 null、不逐 id 换英文。
 *
 * ## 与数值 bundle 的时序
 * `boot.ts` 并发预取 gen bundle 与 i18n names，两者可能先后到达。
 * 名称加载完成后，若宝可梦列表已渲染，会用内存缓存的数值 bundle 重映射一次
 * （`resourceManager` 命中内存 LRU，零网络），把占位名替换成真实名称。
 */
import { resourceManager, FLAVOR_SLICE_SIZE, type FlavorFamily } from '@/services/resources/resourceManager';
import { buildNamesLookup, overlay, type NamesLookup } from '@/services/i18n/lookup';
import {
    buildEffectMap,
    EFFECT_LANGS,
    emptyFlavor,
    keyMoveEffectsByMoveId,
    latestVersionText,
    mergeFlavorRefs,
    mergeVersionedFlavorRefs,
    resolveFlavorLang,
    type ArchiveFlavor,
    type FlavorVersion,
} from '@/services/i18n/flavor';
import type { I18nFlavorBundle } from '@/infra/wasm';
import {
    FALLBACK_LANGUAGE,
    getStoredContentLang,
    getStoredUiLang,
    resolveContentLang,
    resolveUiLocale,
    setStoredContentLang,
    setStoredUiLang,
    type ContentLangSetting,
    type UiLangSetting,
} from '@/services/i18n/languages';
import { TYPE_ID_BY_SLUG } from '@/constants/pokemonTypes';
import { syncUiLocale } from '@/services/i18n/ui-i18n';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

export const useI18nStore = defineStore('i18n', () => {
    /** 内容语言设置（可能为 'auto'） */
    const contentLang = ref<ContentLangSetting>(getStoredContentLang());
    /** UI 语言设置（可能为 'auto'） */
    const uiLang = ref<UiLangSetting>(getStoredUiLang());
    /** 解析后的实际内容语言（bundle id），供加载与查询使用 */
    const currentLang = computed(() => resolveContentLang(contentLang.value));
    /** 叠加英文回落之后的查找表；未加载完成时为 null */
    const lookup = ref<NamesLookup | null>(null);
    const loading = ref(false);
    let loadPromise: Promise<void> | null = null;

    /**
     * 描述组查找表（物种图鉴描述 + 招式/特性/道具说明 + 效果简述）。
     * 描述组体积占 i18n 约 90%、按族分片，**不随名称预取**：由
     * `ensureFlavorEntry` 按实体算片号、逐片拉取合并进来。`flavor` 用 shallowRef ——
     * 数据量大，每次片到达**整体替换引用**触发一次响应（不逐条代理）。
     */
    const flavor = shallowRef<ArchiveFlavor | null>(null);
    const flavorReady = computed(() => flavor.value !== null);
    /** 已加载的 `(lang:family)` → 片号集合，避免同一片重复下载 */
    const loadedFlavorSlices = new Map<string, Set<number>>();
    /** 效果文件已加载 / 确认该语言没有效果（en/fr/de 之外）的语言（特性段用） */
    let effectsLoadedLang: string | null = null;
    /** 已按键进 `moveEffects` 的效果语言（招式段用，可能为回落 en） */
    let moveEffectsLoadedLang: string | null = null;

    async function loadFor(lang: string): Promise<NamesLookup> {
        // 基线语言与首选语言相同（en）时无需叠加两次
        if (lang === FALLBACK_LANGUAGE) {
            return buildNamesLookup(await resourceManager.getI18nNames(lang));
        }
        const [fallbackBundle, preferredBundle] = await Promise.all([
            resourceManager.getI18nNames(FALLBACK_LANGUAGE),
            // 首选语言加载失败时回落英文（不阻塞整个 i18n 初始化）
            resourceManager.getI18nNames(lang).catch((err) => {
                console.warn(`[i18n] ${lang} 名称组加载失败，回落英文`, err);
                return null;
            }),
        ]);
        const base = buildNamesLookup(fallbackBundle);
        return preferredBundle ? overlay(base, buildNamesLookup(preferredBundle)) : base;
    }

    /** 加载当前语言（含英文回落）。并发调用共享同一次 promise。 */
    function ensureLoaded(): Promise<void> {
        if (lookup.value) return Promise.resolve();
        if (loadPromise) return loadPromise;

        loading.value = true;
        loadPromise = loadFor(currentLang.value)
            .then((table) => {
                lookup.value = table;
                // 名称就绪后重映射已加载的宝可梦列表（数值 bundle 命中内存缓存）
                refreshPokemonIfLoaded();
            })
            .finally(() => {
                loading.value = false;
                loadPromise = null;
            });
        return loadPromise;
    }

    /**
     * 切换内容语言：持久化偏好；若解析后的实际语言变化则重载查找表。
     * 设为与当前相同的设置（含 auto 解析后相同）时直接返回。
     */
    async function setContentLang(setting: ContentLangSetting): Promise<void> {
        if (setting === contentLang.value && lookup.value) return;
        const nextLang = resolveContentLang(setting);
        setStoredContentLang(setting);
        contentLang.value = setting;
        if (nextLang === currentLang.value && lookup.value) return;

        loading.value = true;
        try {
            lookup.value = await loadFor(nextLang);
            // 描述组按 (lang, family) 累积合并，语言切换后清空，下次详情页按需重拉
            flavor.value = null;
            loadedFlavorSlices.clear();
            effectsLoadedLang = null;
            moveEffectsLoadedLang = null;
            refreshPokemonIfLoaded();
        } finally {
            loading.value = false;
        }
    }

    /** 切换 UI 语言：持久化偏好并同步界面静态文案。 */
    function setUiLang(setting: UiLangSetting): void {
        if (setting === uiLang.value) return;
        setStoredUiLang(setting);
        uiLang.value = setting;
        syncUiLocale(resolveUiLocale(setting));
    }

    /**
     * 按需加载某实体族的描述分片并合并进查找表。
     *
     * 片号由实体 id 确定性算出（`(id-1)//128`，契约常量见 `resourceManager`），
     * 不请求任何清单；空档位 / 空语言的 404 属「该档无描述」，静默容忍、不标记
     * 已加载（下次仍可重试）。同一片被多个实体并发请求时共享 `resourceManager`
     * 的 inflight 去重，await 后还有一次本地守卫兜底。语言级回落走
     * `resolveFlavorLang`（cs/pt-br/ja-roma → en），不逐 id 换英文。
     */
    async function ensureFlavorEntry(family: FlavorFamily, id: number): Promise<void> {
        if (!id) return;
        const lang = resolveFlavorLang(currentLang.value);
        const slice = Math.floor((id - 1) / FLAVOR_SLICE_SIZE);
        const key = `${lang}:${family}`;
        const loaded = loadedFlavorSlices.get(key);
        if (loaded?.has(slice)) return;

        let bundle: I18nFlavorBundle;
        try {
            bundle = await resourceManager.getI18nFlavorSlice(lang, family, slice);
        } catch (err) {
            console.warn(`[i18n] ${lang}/${family} 分片 ${slice} 加载失败（404 = 该档无描述）`, err);
            return;
        }
        // 并发守卫：await 期间另一个实体可能已把同片合并进来
        if (loadedFlavorSlices.get(key)?.has(slice)) return;

        const cur = flavor.value ?? emptyFlavor();
        // species 保留全部版本（详情页按版本切换）；其余三族只留最新一条
        if (family === 'species') {
            flavor.value = {
                ...cur,
                species: mergeVersionedFlavorRefs(cur.species, bundle.species),
            };
        } else {
            flavor.value = { ...cur, [family]: mergeFlavorRefs(cur[family], bundle[family]) };
        }
        if (!loadedFlavorSlices.has(key)) loadedFlavorSlices.set(key, new Set());
        loadedFlavorSlices.get(key)!.add(slice);
    }

    /**
     * 在指定效果语言下加载 effects.bin，并把 moveEffects 经 `Move.effectId` join
     * 重新按键为 moveId → 文本（修复上游按 move_effect_id 主键、与招式 id 不对齐的
     * 缺陷）。需同时拉 MDAT 全量招式（缓存命中）做扇出。
     *
     * `populateAbility` 为真时才写 abilityEffects —— 非 en 内容语言回落加载英文效果
     * 时不应把特性表也换成英文（特性卡维持「非 en/fr/de 隐藏」的现状）。
     */
    async function loadEffectsIn(effectLang: string, populateAbility: boolean): Promise<void> {
        const [bundle, md] = await Promise.all([
            resourceManager.getI18nFlavorEffects(effectLang),
            resourceManager.getMovesData('common'),
        ]);
        const cur = flavor.value ?? emptyFlavor();
        flavor.value = {
            ...cur,
            ...(populateAbility ? { abilityEffects: buildEffectMap(bundle.abilityEffects) } : {}),
            moveEffects: keyMoveEffectsByMoveId(md.moves, buildEffectMap(bundle.moveEffects)),
        };
    }

    /**
     * 按需加载效果文件（特性段用）。仅 en/fr/de 有数据：其余语言是**确定 404**，
     * 直接标记已处理、不发那次请求，特性效果查询自然为空、UI 隐藏。请求失败（网络
     * 等真故障）不标记，允许下次重试。
     */
    async function ensureFlavorEffects(): Promise<void> {
        const lang = resolveFlavorLang(currentLang.value);
        if (effectsLoadedLang === lang) return;
        if (!EFFECT_LANGS.includes(lang)) {
            effectsLoadedLang = lang;
            return;
        }
        try {
            await loadEffectsIn(lang, true);
            effectsLoadedLang = lang;
            // 同一效果语言也已按键进 moveEffects，同步标志，招式段不必再加载一次
            moveEffectsLoadedLang = lang;
        } catch (err) {
            console.warn(`[i18n] ${lang} 效果文件加载失败`, err);
        }
    }

    /**
     * 按需加载招式效果（招式段用）。当前内容语言在 en/fr/de 时用对应语言；否则
     * **回落英文** effects.bin —— 效果上游无中日韩文本，回落以保证中文用户也能看到
     * 机制效果（招式正文仍为当前语言）。请求失败不标记，允许下次重试。
     */
    async function ensureMoveEffects(): Promise<void> {
        const lang = resolveFlavorLang(currentLang.value);
        const effectLang = EFFECT_LANGS.includes(lang) ? lang : FALLBACK_LANGUAGE;
        if (moveEffectsLoadedLang === effectLang) return;
        try {
            // 首选语言（en/fr/de）下连同特性表一起加载；纯英文回落时不碰特性表
            await loadEffectsIn(effectLang, EFFECT_LANGS.includes(lang));
            moveEffectsLoadedLang = effectLang;
            if (lang === effectLang) effectsLoadedLang = lang;
        } catch (err) {
            console.warn(`[i18n] ${effectLang} 招式效果加载失败`, err);
        }
    }

    /**
     * 若宝可梦 store 已有数据，用内存缓存重映射一遍以应用新名称。
     * 动态 import 打断静态依赖环（pokemon service → 本 store）。
     */
    function refreshPokemonIfLoaded(): void {
        import('@/store/pokemon')
            .then(({ usePokemonStore }) => {
                const pokemon = usePokemonStore();
                if (pokemon.allPokemons.length > 0) {
                    void pokemon.fetchPokemon(pokemon.currentGenId);
                }
            })
            .catch((err) => console.warn('[i18n] 刷新宝可梦名称失败', err));
    }

    // ── 同步查询（lookup 未就绪时返回 fallback） ──

    const ready = computed(() => lookup.value !== null);

    function speciesName(speciesId: number): string | null {
        return lookup.value?.species.get(speciesId)?.name ?? null;
    }
    function speciesGenus(speciesId: number): string | null {
        return lookup.value?.species.get(speciesId)?.genus ?? null;
    }
    /** 该物种在各游戏版本下的图鉴描述（按 version 升序）；未加载返回 []。 */
    function speciesFlavorVersions(speciesId: number): FlavorVersion[] {
        return flavor.value?.species.get(speciesId) ?? [];
    }
    /**
     * 物种图鉴描述（最新版本一条）；描述组未加载或该物种无文本时返回 null。
     * 详情页默认走版本图标选择器；仅当该物种没有任何「有图标版本」描述时
     * （只有 gen1–5 老版本）才回落到此，避免空白。
     */
    function speciesFlavorText(speciesId: number): string | null {
        const versions = flavor.value?.species.get(speciesId);
        return versions ? latestVersionText(versions) : null;
    }
    /** PokeAPI version_id → 当前内容语言的版本名（图鉴版本标签无障碍名用）。 */
    function versionName(versionId: number): string | null {
        return lookup.value?.versions.get(versionId) ?? null;
    }
    /** 招式说明（最新版本组一条）；未加载或无文本时返回 null。 */
    function moveFlavorText(moveId: number): string | null {
        return flavor.value?.moves.get(moveId) ?? null;
    }
    /** 特性说明；未加载或无文本时返回 null。 */
    function abilityFlavorText(abilityId: number): string | null {
        return flavor.value?.abilities.get(abilityId) ?? null;
    }
    /** 道具说明；未加载或无文本时返回 null。 */
    function itemFlavorText(itemId: number): string | null {
        return flavor.value?.items.get(itemId) ?? null;
    }
    /**
     * 特性/招式效果简述（ProseEffect）。上游仅英文 bundle 有数据，
     * 非英文语言返回 null，调用方应隐藏效果段。
     */
    function abilityEffect(abilityId: number): string | null {
        return flavor.value?.abilityEffects.get(abilityId) ?? null;
    }
    function moveEffect(moveId: number): string | null {
        return flavor.value?.moveEffects.get(moveId) ?? null;
    }
    /** 招式分类名（物理/特殊/状态），未就绪返回 null 由调用方回落。 */
    function moveDamageClassName(id: number): string | null {
        return lookup.value?.moveDamageClasses.get(id) ?? null;
    }
    /** 招式目标名，未就绪返回 null。 */
    function moveTargetName(id: number): string | null {
        return lookup.value?.moveTargets.get(id) ?? null;
    }
    /**
     * 形态名，未就绪返回 null。优先 `form_name`（形态描述，如「攻击形态」）；
     * 部分形态（图腾、羁绊变身甲贺忍蛙等）该列在所有语言都为空，回落 `pokemon_name`
     * 完整形态名（含物种名，如 Totem Alolan Raticate），避免显示「形态 #id」占位。
     */
    function formLabel(formId: number): string | null {
        const f = lookup.value?.forms.get(formId);
        return f?.formName || f?.pokemonName || null;
    }
    function moveName(id: number): string | null {
        return lookup.value?.moves.get(id) ?? null;
    }
    function abilityName(id: number): string | null {
        return lookup.value?.abilities.get(id) ?? null;
    }
    function eggGroupName(id: number): string | null {
        return lookup.value?.eggGroups.get(id) ?? null;
    }
    function itemName(id: number): string | null {
        return lookup.value?.items.get(id) ?? null;
    }
    function evolutionTriggerName(id: number): string | null {
        return lookup.value?.evolutionTriggers.get(id) ?? null;
    }
    function regionName(id: number): string | null {
        return lookup.value?.regions.get(id) ?? null;
    }
    function natureName(id: number): string | null {
        return lookup.value?.natures.get(id) ?? null;
    }

    /**
     * 属性 slug（'fire'）→ 本地化名称。slug 先经 `TYPE_ID_BY_SLUG` 反查到
     * 数字 id（与 i18n types 表同键），再查表。未就绪 / 未知 slug 返回 null，
     * 由调用方回落硬编码名。
     */
    function typeName(slug: string): string | null {
        const id = TYPE_ID_BY_SLUG[slug?.toLowerCase()];
        if (id === undefined) return null;
        return lookup.value?.types.get(id) ?? null;
    }

    return {
        // 设置
        contentLang,
        uiLang,
        currentLang,
        loading,
        ready,
        lookup,
        ensureLoaded,
        setContentLang,
        setUiLang,
        // 图鉴描述（按需加载，分片累积）
        flavorReady,
        ensureFlavorEntry,
        ensureFlavorEffects,
        ensureMoveEffects,
        speciesFlavorVersions,
        speciesFlavorText,
        versionName,
        moveFlavorText,
        abilityFlavorText,
        itemFlavorText,
        abilityEffect,
        moveEffect,
        moveDamageClassName,
        moveTargetName,
        // 查询
        speciesName,
        speciesGenus,
        formLabel,
        moveName,
        abilityName,
        eggGroupName,
        itemName,
        evolutionTriggerName,
        regionName,
        natureName,
        typeName,
    };
});
