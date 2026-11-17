<template>
    <!-- HOME 公告卡结构：彩色头部条（分类名 + 右侧游戏小图标）→ 白卡正文（标题 →
         banner（叠加简要说明）→ 右下日期）。重要公告左上角红色感叹号。 -->
    <view class="notice-card" @click="emit('select')">
        <view class="notice-card__flag" v-if="notice.isImportant">
            <text class="notice-card__flag-mark">!</text>
        </view>

        <view class="notice-card__header" :class="{ 'notice-card__header--flagged': notice.isImportant }">
            <text class="notice-card__kind">{{ kindLabel }}</text>
            <view v-if="romIcons.length > 0" class="notice-card__roms">
                <image
                    v-for="icon in romIcons"
                    :key="icon"
                    :src="icon"
                    mode="aspectFit"
                    class="notice-card__rom-icon"
                />
            </view>
        </view>

        <view class="notice-card__body">
            <text class="notice-card__title">{{ notice.title }}</text>

            <view v-if="notice.bannerUrl" class="notice-card__banner-wrap">
                <image
                    :src="notice.bannerUrl"
                    mode="widthFix"
                    class="notice-card__banner"
                    @error="bannerFailed = true"
                />
                <view v-if="!bannerFailed" class="notice-card__banner-note">
                    <text class="notice-card__banner-note-text">{{ t('notices.bannerNote') }}</text>
                </view>
            </view>

            <text class="notice-card__date">{{ dateLabel }}</text>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { NOTICE_ROM_ICONS } from '@/constants/noticeRoms';
import type { NoticeEntry } from '@/services/notices/notices';

const props = defineProps<{
    notice: NoticeEntry;
    /** 分类二标签文案（kind2 → 标签的映射在页面层，组件不感知 i18n） */
    kindLabel: string;
}>();

const emit = defineEmits<{ select: [] }>();

const { t } = useI18n();

/** 关联作品图标（未知编号忽略；加载失败的 ROM 编号同样过滤） */
const romIcons = computed(() =>
    (props.notice.linkRom ?? []).map((code) => NOTICE_ROM_ICONS[code]).filter((p): p is string => p !== undefined),
);

// 换条目时重置 banner 加载失败标记（key 用 id，复用组件实例的场景）
const bannerFailed = ref(false);
watch(
    () => props.notice.id,
    () => {
        bannerFailed.value = false;
    },
);

/** 两位数字（日期展示用） */
const two = (n: number) => String(n).padStart(2, '0');

/** 快照数据以天为单位变化，展示到日期即可（与 App 同为 YYYY/MM/DD） */
const dateLabel = computed(() => {
    const d = new Date(props.notice.updatedAt * 1000);
    return `${d.getFullYear()}/${two(d.getMonth() + 1)}/${two(d.getDate())}`;
});
</script>

<style lang="scss" scoped>
.notice-card {
    position: relative;
    border-radius: 18px;
    background: #fff;
    border: 1px solid rgba(48, 55, 72, 0.08);
    box-shadow: 0 10px 26px rgba(48, 55, 72, 0.08);
    transition: transform 0.18s ease;

    &:active {
        transform: scale(0.985);
    }
}

.notice-card__flag {
    position: absolute;
    left: -7px;
    top: -7px;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    background: #e8574d;
    border-radius: 999px;
    transform: rotate(-8deg);
    box-shadow: 0 2px 8px rgba(232, 87, 77, 0.45);
}

.notice-card__flag-mark {
    color: #fff;
    font-size: 19px;
    font-weight: 900;
    line-height: 1;
}

/* 分类头部条：色相按分类走（HOME 蓝灰 / 关联作品青绿 / 其他紫），白字加粗。
   上圆角贴卡片（overflow:hidden 已从卡片移除，让左上角感叹号能探出边框） */
.notice-card__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    min-height: 40px;
    background: #63c1b4;
    border-radius: 17px 17px 0 0;
}

/* 重要卡左上角感叹号探出边框，头部条让出它的位置 */
.notice-card__header--flagged {
    padding-left: 30px;
}

.notice-card__kind {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 800;
    color: #fff;
}

.notice-card__roms {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    margin-left: auto;
}

.notice-card__rom-icon {
    width: 22px;
    height: 22px;
    border-radius: 5px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.notice-card__body {
    padding: 12px 14px 10px;
}

.notice-card__title {
    display: block;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
    color: #24262b;
}

.notice-card__banner-wrap {
    position: relative;
    margin-top: 10px;
    overflow: hidden;
    border-radius: 10px;
}

.notice-card__banner {
    display: block;
    width: 100%;
}

/* banner 底部渐变遮罩上的简要说明（「点击查看官方详情」） */
.notice-card__banner-note {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 26px 10px 7px;
    background: linear-gradient(to top, rgba(12, 18, 28, 0.72), rgba(12, 18, 28, 0));
}

.notice-card__banner-note-text {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.94);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

.notice-card__date {
    display: block;
    margin-top: 8px;
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 700;
    color: #8d929c;
}
</style>
