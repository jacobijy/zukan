<template>
    <!--
        模板只读视图（观察模式）：宝可梦 / 规则 / 性格 / 道具 / 招式 + 六维（IV/EV 或 SP）。
        与 TemplateBuildEditor 成对：那边是编辑内核，这边是纯展示。名称全部走 i18n bundle
        本地解析；招式池按形态懒加载（service 缓存与编辑内核共用）。
    -->
    <view class="tpl-ro">
        <!-- 宝可梦头卡 -->
        <view class="tpl-ro__hero glass-panel">
            <view class="tpl-ro__hero-main">
                <EncryptedSprite
                    :pokemon-id="payload.pokemon_id"
                    variant="front"
                    :preview="false"
                    :has-sprite="speciesModel?.hasSprite"
                    img-class="h-[72px] w-[72px]"
                    skeleton-class="h-[72px] w-[72px]"
                />
                <view class="tpl-ro__hero-info">
                    <view class="tpl-ro__title-row">
                        <text class="tpl-ro__species">{{ speciesName }}</text>
                        <text v-if="formLabel" class="tpl-ro__form">{{ formLabel }}</text>
                    </view>
                    <view class="tpl-ro__types">
                        <TypeBadge v-for="ty in speciesModel?.types ?? []" :key="ty" :type="ty" size="xs" variant="chip" />
                    </view>
                    <view class="tpl-ro__tags">
                        <text class="tpl-ro__ruleset">
                            {{ payload.ruleset === 'champions' ? t('templates.rulesetChampions') : t('templates.rulesetStandard') }}
                        </text>
                    </view>
                </view>
            </view>
        </view>

        <!-- 性格 / 道具 -->
        <view class="glass-panel tpl-ro__rows">
            <view class="tpl-ro__row">
                <text class="tpl-ro__row-label">{{ natureLabel }}</text>
                <text class="tpl-ro__row-value">{{ natureText }}</text>
            </view>
            <view class="tpl-ro__row">
                <text class="tpl-ro__row-label">{{ t('templates.fieldItem') }}</text>
                <text class="tpl-ro__row-value" :class="{ 'tpl-ro__row-value--empty': !itemText }">
                    {{ itemText || t('templates.none') }}
                </text>
            </view>
        </view>

        <!-- 招式 -->
        <view class="glass-panel tpl-ro__moves">
            <view class="tpl-ro__section-head">
                <text class="tpl-ro__row-label">{{ t('templates.fieldMoves') }}</text>
                <text class="tpl-ro__count">{{ payload.moves.length }}/4</text>
            </view>
            <view v-if="payload.moves.length" class="tpl-ro__chips">
                <SelectedMoveChip v-for="m in payload.moves" :key="m" :move-id="m" :type="typeOfMove(m)" />
            </view>
            <text v-else class="tpl-ro__empty">{{ t('templates.none') }}</text>
        </view>

        <!-- 六维：standard = IV + EV；champions = SP -->
        <view v-if="payload.ruleset === 'standard'" class="glass-panel tpl-ro__stats">
            <view class="tpl-ro__stat-block">
                <text class="tpl-ro__section-head-label">IV</text>
                <view class="tpl-ro__stat-grid">
                    <view v-for="k in STAT_KEYS" :key="k" class="tpl-ro__stat">
                        <text class="tpl-ro__stat-label">{{ t(`statcalc.stats.${k}`) }}</text>
                        <text class="tpl-ro__stat-value">{{ payload.ivs[k] }}</text>
                    </view>
                </view>
            </view>
            <view class="tpl-ro__stat-block">
                <view class="tpl-ro__section-head">
                    <text class="tpl-ro__section-head-label">EV</text>
                    <text class="tpl-ro__count">{{ statTotal(payload.evs) }}/510</text>
                </view>
                <view class="tpl-ro__stat-grid">
                    <view v-for="k in STAT_KEYS" :key="k" class="tpl-ro__stat">
                        <text class="tpl-ro__stat-label">{{ t(`statcalc.stats.${k}`) }}</text>
                        <text class="tpl-ro__stat-value" :class="{ 'tpl-ro__stat-value--zero': payload.evs[k] === 0 }">
                            {{ payload.evs[k] }}
                        </text>
                    </view>
                </view>
            </view>
        </view>

        <view v-else class="glass-panel tpl-ro__stats">
            <view class="tpl-ro__section-head">
                <text class="tpl-ro__section-head-label">SP</text>
                <text class="tpl-ro__count">{{ statTotal(payload.sp) }}/66</text>
            </view>
            <view class="tpl-ro__stat-grid">
                <view v-for="k in STAT_KEYS" :key="k" class="tpl-ro__stat">
                    <text class="tpl-ro__stat-label">{{ t(`statcalc.stats.${k}`) }}</text>
                    <text class="tpl-ro__stat-value" :class="{ 'tpl-ro__stat-value--zero': payload.sp[k] === 0 }">
                        {{ payload.sp[k] }}
                    </text>
                </view>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';
import SelectedMoveChip from '@/components/teams/SelectedMoveChip.vue';
import TypeBadge from '@/components/pokemon/TypeBadge.vue';
import { useI18nStore } from '@/store/i18n';
import { usePokemonStore } from '@/store/pokemon';
import { loadMovePoolForForm } from '@/services/teams/member-options';
import type { Stats, TemplatePayload } from '@/services/templates/template-model';

const props = defineProps<{ payload: TemplatePayload }>();

const { t } = useI18n();
const i18nStore = useI18nStore();
const pokemonStore = usePokemonStore();

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

const speciesModel = computed(() => pokemonStore.getById(props.payload.pokemon_id));
const speciesName = computed(() => speciesModel.value?.name ?? `#${props.payload.pokemon_id}`);
const formLabel = computed(() => speciesModel.value?.formLabel ?? '');

// 模板性格存 PokeAPI nature id；standard / champions 的标签随编辑器走同一 i18n 键
const natureLabel = computed(() =>
    props.payload.ruleset === 'champions' ? t('statcalc.alignment') : t('statcalc.nature'),
);
const natureText = computed(() => i18nStore.natureName(props.payload.nature) ?? `#${props.payload.nature}`);
const itemText = computed(() =>
    props.payload.item ? i18nStore.itemName(props.payload.item) ?? '' : '',
);

// ── 招式池（与编辑内核 / MemberCard 共用 service 缓存） ──
const pool = shallowRef<MoveRecord[]>([]);
let loadedFor: number | null = null;
async function ensurePool(id: number): Promise<void> {
    if (loadedFor === id) return;
    loadedFor = id;
    try {
        pool.value = await loadMovePoolForForm(id);
    } catch {
        loadedFor = null;
    }
}
watch(
    () => props.payload.pokemon_id,
    (id) => {
        if (id) void ensurePool(id);
    },
    { immediate: true },
);
function typeOfMove(id: number): string | undefined {
    return pool.value.find((r) => r.id === id)?.type;
}

function statTotal(s: Stats): number {
    return STAT_KEYS.reduce((sum, k) => sum + s[k], 0);
}
</script>

<style lang="scss" scoped>
.tpl-ro {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.tpl-ro__hero-main {
    display: flex;
    align-items: center;
    gap: 12px;
}

.tpl-ro__hero-info {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.tpl-ro__title-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
}

.tpl-ro__species {
    overflow: hidden;
    font-size: 17px;
    font-weight: 900;
    color: #24262b;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tpl-ro__form {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ab;
}

.tpl-ro__types {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.tpl-ro__tags {
    display: flex;
    align-items: center;
    gap: 6px;
}

.tpl-ro__ruleset {
    flex-shrink: 0;
    padding: 2px 8px;
    border: 1px solid #dfe3ea;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    color: #5d6470;
    background: #ffffff;
}

.tpl-ro__rows {
    display: flex;
    flex-direction: column;
}

.tpl-ro__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 46px;
    gap: 12px;
}

.tpl-ro__row + .tpl-ro__row {
    border-top: 1px solid #f6f7fa;
}

.tpl-ro__row-label {
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 700;
    color: #6f7682;
}

.tpl-ro__row-value {
    overflow: hidden;
    font-size: 13px;
    font-weight: 800;
    color: #24262b;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tpl-ro__row-value--empty {
    font-weight: 600;
    color: #b0b5bf;
}

.tpl-ro__moves,
.tpl-ro__stats {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.tpl-ro__section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.tpl-ro__section-head-label {
    font-size: 13px;
    font-weight: 800;
    color: #24262b;
}

.tpl-ro__count {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 800;
    color: #b0b5bf;
}

.tpl-ro__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.tpl-ro__empty {
    font-size: 12px;
    font-weight: 600;
    color: #b0b5bf;
}

.tpl-ro__stat-block + .tpl-ro__stat-block {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid #f6f7fa;
}

.tpl-ro__stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 8px;
}

.tpl-ro__stat {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    border-radius: 10px;
    background: #f6f7fa;
}

.tpl-ro__stat-label {
    font-size: 12px;
    font-weight: 700;
    color: #8d929c;
}

.tpl-ro__stat-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    font-weight: 800;
    color: #24262b;
}

.tpl-ro__stat-value--zero {
    color: #c4c7cf;
}
</style>
