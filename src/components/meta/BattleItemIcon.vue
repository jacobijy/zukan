<template>
    <view
        class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px]"
        :class="failed ? AMBER_TILE : TRAY"
    >
        <image
            v-if="!failed"
            :src="url"
            class="h-6 w-6"
            mode="aspectFit"
            @error="failed = true"
        />
        <!-- 无图（404）：与原道具 glyph 同色的背包图标 -->
        <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4 text-white"
        >
            <path d="M6 7h12l1 13H5L6 7z"></path>
            <path d="M9 7a3 3 0 0 1 6 0"></path>
        </svg>
    </view>
</template>

<script lang="ts" setup>
/**
 * 对战道具图标 —— 用对战数据**自带的明文图标**（`/assets/battle/icons/items/
 * <英文显示名>.png`），不走加密图片通道。契约见 `docs/data/battle-usage.md`「图标」。
 *
 * 图标只覆盖对战中实际被持有的道具，取不到（404）时 @error 切到琥珀背包 glyph，
 * 槽位尺寸（32px）不变，不引起行高跳变。
 */
import { computed, ref, watch } from 'vue';
import { battleItemIconUrl } from '@/services/meta';

const props = defineProps<{
    /** 道具英文显示名（= rows item.name） */
    name: string;
}>();

const url = computed(() => battleItemIconUrl(props.name));
const failed = ref(false);

// 切换到另一个道具时重新尝试
watch(
    () => props.name,
    () => {
        failed.value = false;
    },
);

const TRAY = 'border border-[rgba(36,38,43,0.06)] bg-gradient-to-b from-white to-[#f2f4f8]';
const AMBER_TILE = 'bg-gradient-to-br from-[#f6c969] to-[#d98a23]';
</script>
