<template>
    <view class="text-row">
        <view class="text-row__head">
            <text class="text-row__id">#{{ row.id }}</text>
            <text v-if="row.version !== undefined" class="text-row__version">v{{ row.version }}</text>
        </view>
        <text class="text-row__primary" :class="{ 'text-row__primary--empty': !row.primary }">
            {{ row.primary || '（空串）' }}
        </text>
        <text v-if="row.secondary" class="text-row__secondary">{{ row.secondary }}</text>
    </view>
</template>

<script lang="ts" setup>
/**
 * 文本浏览器的一行。dev-only，文案硬编码中文（理由同 AssetProbeCard）。
 *
 * **空串要显式渲染成「（空串）」**，不能靠 `v-if` 藏掉：排查 i18n 缺字时，
 * 「这条 id 不存在」和「这条 id 存在但文本是空串」是两种完全不同的上游问题，
 * 藏掉就分不出来了。
 */
import type { TextRow } from '@/services/devtools/textBrowse';

defineProps<{ row: TextRow }>();
</script>

<style scoped>
.text-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(36, 38, 43, 0.06);
}

.text-row__head {
    display: flex;
    align-items: center;
    gap: 6px;
}

.text-row__id {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 10px;
    font-weight: 700;
    color: #a2a7b2;
}

.text-row__version {
    padding: 0 5px;
    border-radius: 5px;
    font-size: 9px;
    font-weight: 800;
    line-height: 14px;
    color: #7c6a1f;
    background: #fdf6d8;
}

.text-row__primary {
    font-size: 13px;
    line-height: 19px;
    color: #24262b;
    word-break: break-word;
}

.text-row__primary--empty {
    font-style: italic;
    color: #c8ccd4;
}

.text-row__secondary {
    font-size: 11px;
    line-height: 17px;
    color: #6f7682;
    word-break: break-word;
}
</style>
