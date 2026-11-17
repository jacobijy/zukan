<template>
    <view class="archive-page min-h-screen page-bg" :style="[pageSafeArea, { paddingBottom: '40px' }]">
        <DetailNavbar :title="t('notices.title')" fallback-url="/pages/data/data" />

        <scroll-view
            scroll-y
            class="relative z-10 mt-[var(--navbar-total-height)] h-[calc(100vh-var(--navbar-total-height))] px-4 pb-6"
        >
            <view class="mx-auto flex max-w-[720px] flex-col pt-1">
                <!-- 分组 tab：全部 / Pokémon HOME / 关联软件 / 其他（与 App 公告页同序） -->
                <view v-if="!loading && entries.length > 0" class="notice-tabs">
                    <view
                        v-for="tab in kindTabs"
                        :key="tab.key"
                        class="notice-tabs__item"
                        :class="{ 'notice-tabs__item--active': currentKind === tab.key }"
                        @click="currentKind = tab.key"
                    >
                        <text class="notice-tabs__label">{{ tab.label }}</text>
                    </view>
                </view>

                <view v-if="loading" class="flex items-center justify-center py-20">
                    <view class="field-loader"></view>
                </view>

                <view
                    v-else-if="visibleNotices.length === 0"
                    class="glass-panel mt-3 flex flex-col items-center justify-center px-8 py-14 text-center"
                >
                    <text class="text-xl font-black tracking-[-0.03em] text-[#24262b]">{{
                        t('archive.emptyTitle')
                    }}</text>
                    <text class="mt-2 block text-sm font-medium leading-6 text-[#8d929c]">{{
                        t('notices.emptyDesc')
                    }}</text>
                </view>

                <view v-else class="mt-3 flex flex-col gap-3">
                    <NoticeRow
                        v-for="notice in visibleNotices"
                        :key="notice.id"
                        :notice="notice"
                        :kind-label="kindLabel(notice)"
                        @select="openNotice(notice)"
                    />
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { onLoad } from '@dcloudio/uni-app';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import NoticeRow from '@/components/notices/NoticeRow.vue';
import { loadNotices, type NoticeEntry } from '@/services/notices/notices';
import { usePageSafeArea } from '@/composables/usePageSafeArea';

const pageSafeArea = usePageSafeArea();

const { t } = useI18n();

const entries = ref<NoticeEntry[]>([]);
const loading = ref(true);
const currentKind = ref(0);

/** 分类一（kind）大 tab：0=全部；与 App 公告页「全部 / Pokémon HOME / 关联软件 / 其他」同序 */
const KIND_TABS = [
    { key: 0, labelKey: 'notices.tabAll' },
    { key: 1, labelKey: 'notices.tabHome' },
    { key: 2, labelKey: 'notices.tabTitles' },
    { key: 3, labelKey: 'notices.tabOther' },
] as const;

// 常量数组直接映射 i18n key，t() 是响应式的，语言切换自动刷新
const kindTabs = computed(() => KIND_TABS.map((tab) => ({ key: tab.key, label: t(tab.labelKey) })));

/**
 * 分类二（kind2）标签文案：3=维护、4=更新、7=公告、8=其他作品、9=其他、10=问卷。
 * 未知值回落到「公告」（空标签会破坏头部条布局，宁可错标也不留空白）。
 */
const KIND2_LABEL_KEY: Record<number, string> = {
    3: 'notices.kindMaintenance',
    4: 'notices.kindUpdate',
    7: 'notices.kindNotice',
    8: 'notices.kindTitles',
    9: 'notices.kindOther',
    10: 'notices.kindSurvey',
};

const kindLabel = (notice: NoticeEntry): string => t(KIND2_LABEL_KEY[notice.kind2] ?? 'notices.kindNotice');

const visibleNotices = computed(() => {
    // 重要公告置顶（App 里红色感叹号），其余按 updated_at 降序（服务端已排序）
    const sorted = [...entries.value].toSorted((a, b) => Number(b.isImportant) - Number(a.isImportant));
    if (currentKind.value === 0) return sorted;
    return sorted.filter((n) => n.kind === currentKind.value);
});

onLoad(async () => {
    try {
        entries.value = await loadNotices();
    } catch (err) {
        console.warn('[notices] 公告列表加载失败', err);
    } finally {
        loading.value = false;
    }
});

/**
 * 打开官方详情页。`url` 是 Pokémon HOME 公开 webview HTML，免鉴权。
 * H5 / App 用系统浏览器或内置 webview；小程序不支持打开外部网页，
 * 降级为复制链接提示用户自行访问。
 */
const openNotice = (notice: NoticeEntry) => {
    // #ifdef H5
    window.open(notice.url, '_blank', 'noopener');
    // #endif
    // #ifndef H5
    uni.setClipboardData({
        data: notice.url,
        success: () => {
            uni.showToast({ title: t('notices.linkCopied'), icon: 'none' });
        },
    });
    // #endif
};
</script>

<style lang="scss" scoped>
/* tab 行：等宽四项 + 激活下划线（对齐 App 公告页顶部分组样式） */
.notice-tabs {
    display: flex;
    align-items: stretch;
    border-bottom: 2px solid rgba(48, 55, 72, 0.08);
}

.notice-tabs__item {
    position: relative;
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    padding: 10px 4px 12px;
    transition: opacity 0.15s ease;

    &:active {
        opacity: 0.7;
    }
}

.notice-tabs__label {
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 700;
    color: #8d929c;
}

.notice-tabs__item--active .notice-tabs__label {
    color: #1e5fc2;
    font-weight: 900;
}

/* 下划线骑在容器分隔线上（bottom:-2px），只出现在激活项 */
.notice-tabs__item--active::after {
    position: absolute;
    right: 14px;
    bottom: -2px;
    left: 14px;
    height: 3px;
    content: '';
    background: #1e5fc2;
    border-radius: 3px 3px 0 0;
}
</style>
