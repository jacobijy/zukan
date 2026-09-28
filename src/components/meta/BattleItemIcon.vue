<template>
    <view
        class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px]"
        :class="url ? TRAY : AMBER_TILE"
    >
        <image v-if="url" :src="url" class="h-6 w-6" mode="aspectFit" @error="failed = true" />
        <!-- 无图（404）/ 未登录：琥珀背包图标 -->
        <!-- #ifdef MP-WEIXIN -->
        <text
            v-else
            class="ic text-[16px] text-white"
        >{{ glyph('bag') }}</text>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <svg
            v-else
            data-ic="bag"
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
        <!-- #endif -->
    </view>
</template>

<script lang="ts" setup>
/**
 * 对战道具图标 —— 走对战数据**自带图标的加密通道**（`battleImage.ts`：
 * `/assets/encrypted/battle/<season>/icons/items/<英文显示名>.bin`）。
 * 契约见 docs/data/battle-usage.md「图标」。
 *
 * 道具分区条目少，挂载即取（引擎内部限流 4），不接视口懒加载。取不到（404）或
 * 未登录取消时回落琥珀 bag glyph，槽位 32px 不变，不引起行高跳变。
 */
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { glyph } from '@/components/icon/glyphs';
import { acquireBattleIcon, releaseBattleIcon } from '@/services/resources/battleImage';

const props = defineProps<{
    /** 道具英文显示名（= rows item.name） */
    name: string;
}>();

const url = ref<string | null>(null);
const failed = ref(false);

let controller: AbortController | null = null;
/** 当前已拿到、由本组件持有引用的 key；卸载 / 换名时归还 */
let heldKey: string | null = null;
let disposed = false;

const TRAY = 'border border-[rgba(36,38,43,0.06)] bg-gradient-to-b from-white to-[#f2f4f8]';
const AMBER_TILE = 'bg-gradient-to-br from-[#f6c969] to-[#d98a23]';

function releaseHeld(): void {
    if (!heldKey) return;
    const key = heldKey;
    heldKey = null;
    void releaseBattleIcon('items', key);
}

async function load(name: string): Promise<void> {
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    controller = ac;
    try {
        const blobUrl = await acquireBattleIcon('items', name, { signal: ac?.signal });
        if (disposed || name !== props.name) return;
        // 换名后旧图归还（一般在 watch 里已处理，这里兜底）
        releaseHeld();
        heldKey = name;
        url.value = blobUrl;
        failed.value = false;
    } catch (err) {
        if (disposed || name !== props.name) return;
        // 404 / 未登录取消 / 解密失败：统一回落背包图标
        console.warn('[BattleItemIcon] 道具图标不可用', name, err);
        url.value = null;
        failed.value = true;
    } finally {
        if (controller === ac) controller = null;
    }
}

onMounted(() => {
    void load(props.name);
});

watch(
    () => props.name,
    (next, prev) => {
        if (next === prev) return;
        controller?.abort();
        controller = null;
        releaseHeld();
        url.value = null;
        failed.value = false;
        void load(next);
    },
);

onUnmounted(() => {
    disposed = true;
    controller?.abort();
    controller = null;
    releaseHeld();
});
</script>
