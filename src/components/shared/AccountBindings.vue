<template>
    <view v-if="providers.length > 0" class="bindings glass-panel">
        <text class="section-label">{{ t('account.title') }}</text>

        <view v-for="p in providers" :key="p" class="bindings__row">
            <text class="bindings__label">{{ labelFor(p) }}</text>

            <view
                class="bindings__action"
                :class="isBound(p) ? 'bindings__action--on' : 'bindings__action--off'"
                @click="onToggle(p)"
            >
                <text>{{ isBound(p) ? t('account.unbind') : t('account.bind') }}</text>
            </view>
        </view>

        <view v-if="errorMsg" class="bindings__error">
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

// 契约缺口：当前无「GET /auth/identities」端点，初始绑定态无法获取，默认 best-effort
// 为未绑定；动作后以服务端响应为准。后端补 GET 端点后在此初始化。
const bound = ref<AuthProvider[]>([]);
const busy = ref<AuthProvider | null>(null);
const errorMsg = ref('');

function labelFor(p: AuthProvider): string {
    if (p === 'weixin') return t('login.weixinLogin');
    if (p === 'apple') return t('login.appleLogin');
    return t('login.phoneLogin');
}

function isBound(p: AuthProvider): boolean {
    return bound.value.includes(p);
}

async function onToggle(p: AuthProvider) {
    if (busy.value) return;
    errorMsg.value = '';

    if (isBound(p)) {
        const confirmed = await new Promise<boolean>((resolve) => {
            uni.showModal({
                content: t('account.confirmUnbind'),
                success: (r) => resolve(!!r.confirm),
                fail: () => resolve(false),
            });
        });
        if (!confirmed) return;
    }

    busy.value = p;
    try {
        if (isBound(p)) {
            await manager.unbind(p);
            bound.value = bound.value.filter((x) => x !== p);
        } else {
            const res = await manager.bind(p);
            // 以响应的 identities 为准回写。
            bound.value = providersFromResponse(p, res.identities);
        }
    } catch (err) {
        errorMsg.value = messageFor(err);
    } finally {
        busy.value = null;
    }
}

// 服务端 identities 是字符串列表；映射回已知 provider，未匹配项忽略。
function providersFromResponse(current: AuthProvider, identities: string[]): AuthProvider[] {
    const known: AuthProvider[] = ['weixin', 'apple', 'phone'];
    const set = new Set(identities.map((s) => s.toLowerCase()));
    const next = known.filter((k) => set.has(k));
    return next.includes(current) ? next : [...next, current];
}

function messageFor(err: unknown): string {
    if (err instanceof AuthApiError) {
        if (err.code === 'INVALID_INPUT') return t('account.lastMethodError');
        if (err.code === 'UPSTREAM_UNAVAILABLE') return t('account.upstreamError');
        return err.message;
    }
    return (err as Error)?.message ?? t('login.fallbackError');
}
</script>

<style scoped lang="scss">
.bindings {
    margin: 20px 0 0;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;

    &__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    &__label {
        font-size: 15px;
        color: #2b3440;
    }

    &__action {
        padding: 7px 18px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;

        &--on {
            background: rgba(60, 72, 88, 0.1);
            color: #5b6573;
        }

        &--off {
            background: #3b82f6;
            color: #fff;
        }

        &:active {
            opacity: 0.85;
        }
    }

    &__error {
        font-size: 13px;
        color: #e5484d;
    }
}
</style>
