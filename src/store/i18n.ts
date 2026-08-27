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
 * ## 回落策略
 * 首选语言可能部分或整体缺失（ja-roma 仅有物种名；cs/pt-br 全空），
 * 因此总是先加载英文基线，再用首选语言条目逐表逐 id 覆盖（见 `overlay`）。
 *
 * ## 与数值 bundle 的时序
 * `boot.ts` 并发预取 gen bundle 与 i18n names，两者可能先后到达。
 * 名称加载完成后，若宝可梦列表已渲染，会用内存缓存的数值 bundle 重映射一次
 * （`resourceManager` 命中内存 LRU，零网络），把占位名替换成真实名称。
 */
import { resourceManager } from '@/services/resources/resourceManager';
import { buildNamesLookup, overlay, type NamesLookup } from '@/services/i18n/lookup';
import { buildSpeciesFlavor, overlayFlavor, type SpeciesFlavor } from '@/services/i18n/flavor';
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
import { computed, ref } from 'vue';

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
     * 物种图鉴描述（speciesId → 文本）。描述组体积占 i18n 约 90%，
     * **不随名称预取**，仅在详情页需要时 `ensureFlavor()` 按需加载。
     * `flavorLang` 记录已加载语言，切换内容语言后置 null 触发重载。
     */
    const flavor = ref<SpeciesFlavor | null>(null);
    const flavorReady = computed(() => flavor.value !== null);
    let flavorPromise: Promise<void> | null = null;
    let flavorLang: string | null = null;

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
            // 描述组按语言缓存，语言切换后置空，下次详情页按需重载
            flavor.value = null;
            flavorLang = null;
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
     * 按需加载当前语言的图鉴描述（含英文回落）。并发调用共享同一次 promise；
     * 已加载且语言未变时直接复用。描述组体积大，不随 boot / 名称预取。
     */
    function ensureFlavor(): Promise<void> {
        const lang = currentLang.value;
        if (flavor.value && flavorLang === lang) return Promise.resolve();
        if (flavorPromise && flavorLang === lang) return flavorPromise;

        flavorLang = lang;
        flavorPromise = loadFlavorFor(lang)
            .then((table) => {
                flavor.value = table;
            })
            .catch((err) => {
                // 失败不缓存语言标记，允许下次进入详情重试
                flavorLang = null;
                console.warn('[i18n] 描述组加载失败', err);
            })
            .finally(() => {
                flavorPromise = null;
            });
        return flavorPromise;
    }

    async function loadFlavorFor(lang: string): Promise<SpeciesFlavor> {
        // 英文基线：首选语言缺失的物种（ja-roma / cs / pt-br）由它补齐
        const [fallback, preferred] = await Promise.all([
            resourceManager.getI18nFlavor(FALLBACK_LANGUAGE),
            lang === FALLBACK_LANGUAGE
                ? Promise.resolve(null)
                : resourceManager.getI18nFlavor(lang).catch((err) => {
                      console.warn(`[i18n] ${lang} 描述组加载失败，回落英文`, err);
                      return null;
                  }),
        ]);
        const base = buildSpeciesFlavor(fallback);
        return preferred ? overlayFlavor(base, buildSpeciesFlavor(preferred)) : base;
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
    /** 物种图鉴描述；描述组未加载或该物种无文本时返回 null。 */
    function speciesFlavorText(speciesId: number): string | null {
        return flavor.value?.get(speciesId) ?? null;
    }
    function formLabel(formId: number): string | null {
        return lookup.value?.forms.get(formId)?.formName ?? null;
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
        // 图鉴描述（按需加载）
        flavorReady,
        ensureFlavor,
        speciesFlavorText,
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
