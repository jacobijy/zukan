<template>
    <view class="archive-section px-4 py-4">
        <view class="mb-3 flex items-center justify-between gap-2">
            <text class="text-base font-black tracking-[-0.02em] text-[#24262b]">{{ title }}</text>
            <text class="text-[10px] font-black tracking-[0.14em] text-[#8d929c]">SPREAD</text>
        </view>

        <view v-if="rows.length" class="spread-card">
            <!-- 表头 -->
            <view class="spread-grid spread-grid--head">
                <text class="spread-grid__rank">#</text>
                <text v-for="(col, ci) in statColumns" :key="ci">{{ col }}</text>
                <text class="spread-grid__pct">{{ t('meta.usageRate') }}</text>
            </view>

            <!-- 数据行 -->
            <view
                v-for="(row, i) in rows"
                :key="i"
                class="spread-grid spread-grid--data"
            >
                <text class="spread-grid__rank">{{ i + 1 }}</text>
                <text v-for="(value, vi) in statValues(row)" :key="vi">{{ value }}</text>
                <text class="spread-grid__pct">{{ row.pct }}%</text>
            </view>
        </view>

        <text v-else class="block py-2 text-center text-xs font-bold text-[#b6bac3]">{{ t('meta.pokemonEmpty') }}</text>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SpreadRowVM } from '@/services/meta';

defineProps<{
    title: string;
    rows: SpreadRowVM[];
}>();

const { t } = useI18n();

// 六维列名复用 teams.sp 名称表（含速度），避免再复制一份
const statColumns = computed(() => [
    t('teams.sp.hp'), t('teams.sp.atk'), t('teams.sp.def'),
    t('teams.sp.spa'), t('teams.sp.spd'), t('teams.sp.spe'),
]);

// 列顺序与 statColumns 对应：HP / 攻击 / 防御 / 特攻 / 特防 / 速度
const statValues = (r: SpreadRowVM) => [r.hp, r.atk, r.def, r.spa, r.spd, r.spe];
</script>

<style lang="scss" scoped>
$separator: rgba(60, 60, 67, 0.12);

.spread-card {
    border: 1px solid #e8eaf0;
    border-radius: 14px;
    background: #ffffff;
    overflow: hidden;
}

/* # / 六项 / 使用率：数字列等宽 */
.spread-grid {
    display: grid;
    grid-template-columns: 22px repeat(6, minmax(0, 1fr)) 50px;
    align-items: center;
}

.spread-grid--head {
    background: #f7f8fa;
    border-bottom: 0.5px solid $separator;

    text {
        padding: 9px 0;
        color: #8d929c;
        font-size: 10px;
        font-weight: 700;
        text-align: center;
    }
}

.spread-grid--data {
    border-bottom: 0.5px solid $separator;

    &:last-child {
        border-bottom: none;
    }

    text {
        padding: 8px 0;
        color: #3a4050;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12.5px;
        font-weight: 600;
        text-align: center;
        font-variant-numeric: tabular-nums;
    }
}

.spread-grid__rank {
    color: #9aa0ac !important;
}

/* 使用率列右对齐，列头与数值对齐 */
.spread-grid__pct {
    padding-right: 10px !important;
    text-align: right !important;
}

.spread-grid--data .spread-grid__pct {
    color: #24262b !important;
    font-weight: 800;
}
</style>
