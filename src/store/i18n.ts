/**
 * 多语言文本 store。
 *
 * 负责加载 PKNM 名称组 bundle、按英文回落叠加成查找表，并对外暴露
 * 同步名称查询。描述组（PKFL，图鉴/技能描述）体积较大、按需加载，
 * 不在启动路径里。
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
import {
    FALLBACK_LANGUAGE,
    getPreferredLanguage,
    getStoredLanguage,
    setStoredLanguage,
} from '@/services/i18n/languages';
import { syncUiLocale } from '@/services/i18n/ui-i18n';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const useI18nStore = defineStore('i18n', () => {
    /** 当前语言 identifier */
    const currentLang = ref<string>(getStoredLanguage() ?? getPreferredLanguage());
    /** 叠加英文回落之后的查找表；未加载完成时为 null */
    const lookup = ref<NamesLookup | null>(null);
    const loading = ref(false);
    let loadPromise: Promise<void> | null = null;

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

    /** 切换语言：持久化偏好并重载查找表 */
    async function setLanguage(lang: string): Promise<void> {
        if (lang === currentLang.value && lookup.value) return;
        setStoredLanguage(lang);
        currentLang.value = lang;
        // 同步界面静态文案（vue-i18n）的 locale
        syncUiLocale(lang);
        loading.value = true;
        try {
            lookup.value = await loadFor(lang);
            refreshPokemonIfLoaded();
        } finally {
            loading.value = false;
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
    function formLabel(formId: number): string | null {
        return lookup.value?.forms.get(formId)?.formName ?? null;
    }
    function moveName(id: number): string | null {
        return lookup.value?.moves.get(id) ?? null;
    }
    function abilityName(id: number): string | null {
        return lookup.value?.abilities.get(id) ?? null;
    }
    function itemName(id: number): string | null {
        return lookup.value?.items.get(id) ?? null;
    }
    function natureName(id: number): string | null {
        return lookup.value?.natures.get(id) ?? null;
    }

    return {
        currentLang,
        loading,
        ready,
        lookup,
        ensureLoaded,
        setLanguage,
        speciesName,
        speciesGenus,
        formLabel,
        moveName,
        abilityName,
        itemName,
        natureName,
    };
});
