<template>
    <view class="flex items-center gap-3">
        <view class="evolution-node" @click="open">
            <view class="evolution-node__image">
                <EncryptedSprite
                    :pokemon-id="stage.id"
                    variant="home"
                    img-class="h-14 w-14"
                    skeleton-class="h-14 w-14"
                />
            </view>
            <text class="mt-2 block text-center text-sm font-black leading-tight text-[#24262b]">{{ stage.name || `NO.${String(stage.id).padStart(3, '0')}` }}</text>
        </view>

        <view v-if="stage.children?.length" class="flex flex-col gap-3">
            <view
                v-for="child in stage.children"
                :key="child.id"
                class="flex items-center gap-2"
            >
                <view class="flex w-16 shrink-0 flex-col items-center gap-0.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-[#9da2ad]">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                    <text v-if="edgeLabel(child)" class="text-center text-[10px] font-bold leading-tight text-[#8d929c]">{{ edgeLabel(child) }}</text>
                </view>
                <EvolutionNode :stage="child" />
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import EncryptedSprite from '@/components/sprite/EncryptedSprite.vue';

const props = defineProps<{
    stage: EvolutionStage;
}>();

const emit = defineEmits<{
    select: [id: number];
}>();

/** 边上的条件文案：等级优先，其次触发条件文本；都没有返回空串 */
function edgeLabel(child: EvolutionStage): string {
    if (child.level != null) return `Lv.${child.level}`;
    return child.triggerText ?? '';
}

function open() {
    emit('select', props.stage.id);
}
</script>

<style scoped>
.evolution-node {
    flex: 0 0 auto;
    width: 96px;
    padding: 12px;
    text-align: center;
    border: 1px solid #e5e7ee;
    border-radius: 22px;
    background: #f5f6fa;
    transition: transform 0.15s ease;
}

.evolution-node:active {
    transform: scale(0.96);
}

.evolution-node__image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 70px;
    height: 70px;
    margin: 0 auto;
    border: 1px solid #e5e7ee;
    border-radius: 22px;
    background: #ffffff;
    box-shadow: inset 0 1px 0 #ffffff, 0 10px 18px rgba(48, 55, 72, 0.08);
}
</style>
