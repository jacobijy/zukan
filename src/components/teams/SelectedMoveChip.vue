<template>
    <view class="move-chip">
        <TypeBadge :type="type" size="xs" variant="chip" />
        <text class="move-chip__name">{{ name }}</text>
        <view v-if="removable" class="move-chip__x" @click.stop="emit('remove')">
            <!-- #ifdef MP-WEIXIN -->
            <text class="ic text-[12px]">{{ glyph('x') }}</text>
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <svg data-ic="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" class="h-3 w-3">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <!-- #endif -->
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import TypeBadge from '@/components/pokemon/TypeBadge.vue';
import { useI18nStore } from '@/store/i18n';
import { glyph } from '@/components/icon/glyphs';

const props = defineProps<{
    moveId: number;
    /** 属性 slug（从成员招式池按 id 取）；缺失回落 normal */
    type?: string;
    removable?: boolean;
}>();

const emit = defineEmits<{ remove: [] }>();

const i18nStore = useI18nStore();

const name = computed(() => i18nStore.moveName(props.moveId) ?? `#${props.moveId}`);
const type = computed(() => props.type ?? 'normal');
</script>

<style lang="scss" scoped>
.move-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 4px;
    border: 1px solid #e8eaf0;
    border-radius: 10px;
    background: #ffffff;
}

.move-chip__name {
    font-size: 12px;
    font-weight: 700;
    color: #24262b;
}

.move-chip__x {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b0b5bf;

    &:active {
        color: #e04f47;
    }
}
</style>
