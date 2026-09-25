<template>
    <view v-if="providers.length > 0" class="social">
        <view class="social__divider">
            <view class="social__line"></view>
            <text class="social__divider-text">{{ t('login.socialDivider') }}</text>
            <view class="social__line"></view>
        </view>

        <view class="social__buttons">
            <view
                v-for="p in providers"
                :key="p"
                class="social__btn"
                :class="`social__btn--${p}`"
                @click="onSelect(p)"
            >
                <view class="social__icon" v-html="iconFor(p)"></view>
                <text class="social__label">{{ labelFor(p) }}</text>
            </view>
        </view>

        <view v-if="errorMsg" class="social__error">
            <text>{{ errorMsg }}</text>
        </view>
    </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AuthProvider } from '@/infra/platform';
import { getPlatformManager } from '@/services/platform/managers';
import { AuthApiError } from '@/services/api';

const { t } = useI18n();

const manager = getPlatformManager();

defineProps<{ providers: AuthProvider[] }>();
const emit = defineEmits<{ (e: 'success'): void }>();

const busy = ref<AuthProvider | null>(null);
const errorMsg = ref('');

function labelFor(p: AuthProvider): string {
    if (p === 'weixin') return t('login.weixinLogin');
    if (p === 'apple') return t('login.appleLogin');
    return t('login.phoneLogin');
}

// 单色品牌 glyph（currentColor），避免新增静态资源。
const ICONS: Record<Exclude<AuthProvider, 'platform'>, string> = {
    weixin:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.7 3C4.9 3 2 5.5 2 8.6c0 1.8 1 3.4 2.6 4.5l-.6 2 2.3-1.2c.7.2 1.5.3 2.3.3h.4a4.6 4.6 0 0 1-.2-1.3c0-2.9 2.8-5.2 6.3-5.2h.4C15 4.8 12.1 3 8.7 3Zm-2.4 3.4a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Zm4.8 0a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z"/><path d="M22 13.4c0-2.6-2.5-4.7-5.6-4.7s-5.6 2.1-5.6 4.7 2.5 4.7 5.6 4.7c.6 0 1.3-.1 1.9-.3l1.8 1-.5-1.6c1.4-.9 2.4-2.3 2.4-3.8Zm-7.4-.9a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Zm3.7 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Z"/></svg>',
    apple:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.9-3-.9-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.8 3-.8s1.8.8 3 .8c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8ZM14.2 5.9c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2-.5 2.7-1.3Z"/></svg>',
    phone:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm-5 18a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm5.5-4H6.5V5h11v11Z"/></svg>',
};

function iconFor(p: AuthProvider): string {
    return ICONS[p as Exclude<AuthProvider, 'platform'>] ?? '';
}

async function onSelect(p: AuthProvider) {
    if (busy.value) return;
    errorMsg.value = '';
    busy.value = p;
    try {
        await manager.login(p);
        emit('success');
    } catch (err) {
        errorMsg.value =
            err instanceof AuthApiError && err.code === 'UPSTREAM_UNAVAILABLE'
                ? t('account.upstreamError')
                : ((err as Error)?.message ?? t('login.fallbackError'));
    } finally {
        busy.value = null;
    }
}
</script>

<style scoped lang="scss">
.social {
    margin-top: 18px;

    &__divider {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
    }

    &__line {
        flex: 1;
        height: 1px;
        background: rgba(60, 72, 88, 0.15);
    }

    &__divider-text {
        font-size: 12px;
        color: #8a93a3;
        white-space: nowrap;
    }

    &__buttons {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    &__btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        height: 46px;
        border-radius: 14px;
        font-size: 15px;
        font-weight: 600;
        transition: transform 0.12s ease, opacity 0.12s ease;

        &:active {
            transform: scale(0.98);
            opacity: 0.9;
        }
    }

    &__icon {
        width: 20px;
        height: 20px;
        display: flex;

        :deep(svg) {
            width: 100%;
            height: 100%;
        }
    }

    &__btn--weixin {
        background: #07c160;
        color: #fff;
    }

    &__btn--apple {
        background: #111;
        color: #fff;
    }

    &__btn--phone {
        background: #3b82f6;
        color: #fff;
    }

    &__error {
        margin-top: 12px;
        font-size: 13px;
        color: #e5484d;
        text-align: center;
    }
}
</style>
