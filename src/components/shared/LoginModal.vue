<template>
    <!--
        登录 / 注册弹窗。

        用法：
            <LoginModal v-model:visible="showLogin" @success="onLoggedIn" />

        - 通过 v-model:visible 或 :visible + @update:visible 双向绑定显示状态
        - 登录成功后触发 @success，父组件可关闭弹窗、刷新用户态
        - 注册成功后自动切换到登录 tab，并预填用户名（用户仅需再输一次密码）
    -->
    <view
        v-if="visible"
        class="login-mask"
        @touchmove.stop.prevent
        @click.self="handleMaskClick"
    >
        <view class="login-modal" @click.stop>
            <!-- 关闭按钮 -->
            <view class="login-modal__close" @click="close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </view>

            <!-- 顶部品牌 -->
            <view class="login-modal__brand">
                <view class="login-modal__logo">
                    <view class="login-modal__logo-cap"></view>
                </view>
                <text class="login-modal__title">{{ mode === 'login' ? '欢迎回来' : '加入图鉴' }}</text>
                <text class="login-modal__subtitle">
                    {{ mode === 'login' ? '登录以同步收藏与图鉴记录' : '注册后即可开始你的训练师旅程' }}
                </text>
            </view>

            <!-- Tab 切换 -->
            <view class="login-modal__tabs">
                <view
                    class="login-modal__tab"
                    :class="mode === 'login' ? 'login-modal__tab--active' : ''"
                    @click="switchMode('login')"
                >
                    登录
                </view>
                <view
                    class="login-modal__tab"
                    :class="mode === 'register' ? 'login-modal__tab--active' : ''"
                    @click="switchMode('register')"
                >
                    注册
                </view>
                <view
                    class="login-modal__tab-indicator"
                    :style="{ transform: mode === 'login' ? 'translateX(0%)' : 'translateX(100%)' }"
                ></view>
            </view>

            <!-- 表单 -->
            <view class="login-modal__body">
                <!-- 用户名 / 邮箱 -->
                <view class="login-field">
                    <text class="login-field__label">{{ mode === 'login' ? '用户名或邮箱' : '用户名' }}</text>
                    <input
                        v-model.trim="form.identifier"
                        class="login-field__input"
                        :placeholder="mode === 'login' ? '例如 ash 或 ash@pallet.town' : '给自己起个训练师名'"
                        :disabled="loading"
                        maxlength="64"
                    />
                </view>

                <!-- 邮箱（仅注册） -->
                <view v-if="mode === 'register'" class="login-field">
                    <text class="login-field__label">邮箱</text>
                    <input
                        v-model.trim="form.email"
                        class="login-field__input"
                        placeholder="用于找回账号"
                        :disabled="loading"
                        maxlength="128"
                        type="email"
                    />
                </view>

                <!-- 密码 -->
                <view class="login-field">
                    <text class="login-field__label">密码</text>
                    <view class="relative">
                        <input
                            v-model="form.password"
                            class="login-field__input login-field__input--with-suffix"
                            :placeholder="mode === 'login' ? '输入登录密码' : '至少 8 位'"
                            :password="!showPassword"
                            :disabled="loading"
                            maxlength="128"
                        />
                        <view class="login-field__suffix" @click="showPassword = !showPassword">
                            <svg v-if="showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 4.22-5.94"></path>
                                <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.77 19.77 0 0 1-3.17 4.19"></path>
                                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                        </view>
                    </view>
                </view>

                <!-- 错误提示 -->
                <view v-if="errorMsg" class="login-modal__error">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <text>{{ errorMsg }}</text>
                </view>

                <!-- 提交按钮 -->
                <button
                    class="login-modal__submit"
                    :class="loading ? 'login-modal__submit--loading' : ''"
                    :disabled="loading || !canSubmit"
                    @click="onSubmit"
                >
                    <text v-if="!loading">{{ mode === 'login' ? '登录' : '注册并登录' }}</text>
                    <text v-else>处理中…</text>
                </button>

                <!-- 底部辅助 -->
                <view class="login-modal__foot">
                    <text v-if="mode === 'login'">
                        还没有账号？
                        <text class="login-modal__link" @click="switchMode('register')">立即注册</text>
                    </text>
                    <text v-else>
                        已有账号？
                        <text class="login-modal__link" @click="switchMode('login')">直接登录</text>
                    </text>
                </view>
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';
import { authApi, AuthApiError } from '@/services/api';

type Mode = 'login' | 'register';

const props = withDefaults(
    defineProps<{
        visible: boolean;
        /** 默认打开哪个 tab；默认 'login' */
        defaultMode?: Mode;
        /** 点击遮罩是否关闭；默认 true */
        maskClosable?: boolean;
    }>(),
    { defaultMode: 'login', maskClosable: true }
);

const emit = defineEmits<{
    (e: 'update:visible', v: boolean): void;
    (e: 'success', payload: { mode: Mode; identifier: string }): void;
}>();

const mode = ref<Mode>(props.defaultMode);
const showPassword = ref(false);
const loading = ref(false);
const errorMsg = ref('');

const form = reactive({
    identifier: '',
    email: '',
    password: ''
});

// 打开时重置状态
watch(
    () => props.visible,
    (v) => {
        if (v) {
            mode.value = props.defaultMode;
            errorMsg.value = '';
            loading.value = false;
            showPassword.value = false;
        }
    }
);

const canSubmit = computed(() => {
    if (!form.identifier || !form.password) return false;
    if (mode.value === 'register' && !form.email) return false;
    return true;
});

function switchMode(next: Mode) {
    if (loading.value || mode.value === next) return;
    mode.value = next;
    errorMsg.value = '';
}

function close() {
    if (loading.value) return;
    emit('update:visible', false);
}

function handleMaskClick() {
    if (!props.maskClosable) return;
    close();
}

async function onSubmit() {
    if (loading.value || !canSubmit.value) return;

    // 前端预校验：与服务端 400 规则保持一致，避免多一次往返
    if (mode.value === 'register' && [...form.password].length < 8) {
        errorMsg.value = '密码长度至少为 8 个字符';
        return;
    }

    errorMsg.value = '';
    loading.value = true;

    try {
        if (mode.value === 'register') {
            await authApi.register({
                username: form.identifier,
                email: form.email,
                password: form.password
            });
            // 注册成功 → 直接用同一凭据登录
            await authApi.login({
                identifier: form.identifier,
                password: form.password
            });
        } else {
            await authApi.login({
                identifier: form.identifier,
                password: form.password
            });
        }

        emit('success', { mode: mode.value, identifier: form.identifier });
        emit('update:visible', false);
    } catch (err) {
        if (err instanceof AuthApiError) {
            errorMsg.value = err.message;
        } else {
            errorMsg.value = (err as Error)?.message ?? '请求失败，请稍后重试';
        }
    } finally {
        loading.value = false;
    }
}
</script>

<style lang="scss" scoped>
.login-mask {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(24, 27, 34, 0.42);
    backdrop-filter: blur(6px);
    animation: fadeIn 0.18s ease-out;
}

.login-modal {
    position: relative;
    width: 100%;
    max-width: 380px;
    padding: 22px 22px 20px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.82);
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 30px 60px rgba(24, 27, 34, 0.28),
                inset 0 1px 0 rgba(255, 255, 255, 0.9);
    animation: modalIn 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}

.login-modal__close {
    position: absolute;
    top: 14px;
    right: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    color: #6f7481;
    background: #f1f3f8;
    cursor: pointer;
    transition: background-color 0.18s ease, transform 0.18s ease;
}

.login-modal__close:active {
    background: #e4e7ef;
    transform: scale(0.94);
}

.login-modal__brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 16px;
    text-align: center;
}

.login-modal__logo {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    margin-bottom: 12px;
    overflow: hidden;
    border-radius: 18px;
    background: linear-gradient(135deg, #ffe7a8 0%, #f4c849 54%, #e99a24 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42),
                0 10px 20px rgba(63, 70, 86, 0.14);
}

.login-modal__logo::before,
.login-modal__logo::after {
    position: absolute;
    content: '';
}

.login-modal__logo::before {
    top: 10px;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.94);
}

.login-modal__logo::after {
    bottom: -8px;
    width: 42px;
    height: 26px;
    border-radius: 999px 999px 14px 14px;
    background: rgba(255, 255, 255, 0.94);
}

.login-modal__logo-cap {
    position: absolute;
    z-index: 1;
    top: 8px;
    width: 29px;
    height: 9px;
    border-radius: 999px 999px 4px 4px;
    background: #f05245;
}

.login-modal__title {
    font-size: 20px;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #24262b;
}

.login-modal__subtitle {
    margin-top: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #8a8f99;
}

.login-modal__tabs {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-bottom: 16px;
    padding: 4px;
    border-radius: 14px;
    background: #f1f3f8;
}

.login-modal__tab {
    position: relative;
    z-index: 2;
    padding: 8px 0;
    color: #8a8f99;
    font-size: 13px;
    font-weight: 800;
    text-align: center;
    cursor: pointer;
    transition: color 0.2s ease;
}

.login-modal__tab--active {
    color: #24262b;
}

.login-modal__tab-indicator {
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 1;
    width: calc(50% - 4px);
    height: calc(100% - 8px);
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 2px 8px rgba(48, 55, 72, 0.08),
                inset 0 1px 0 rgba(255, 255, 255, 0.9);
    transition: transform 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.1);
}

.login-modal__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.login-field__label {
    display: block;
    margin-bottom: 6px;
    padding-left: 4px;
    color: #6f7481;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.login-field__input {
    width: 100%;
    height: 42px;
    padding: 0 14px;
    border: 1px solid #e1e4eb;
    border-radius: 14px;
    color: #24262b;
    font-size: 14px;
    font-weight: 600;
    background: #f8f9fc;
    box-shadow: inset 0 1px 0 #ffffff;
    outline: none;
    transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}

.login-field__input::placeholder {
    color: #b4b8c0;
    font-weight: 500;
}

.login-field__input:focus {
    border-color: #357df4;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(53, 125, 244, 0.12);
}

.login-field__input:disabled {
    color: #8d929c;
    background: #eef0f5;
    cursor: not-allowed;
}

.login-field__input--with-suffix {
    padding-right: 40px;
}

.login-field__suffix {
    position: absolute;
    top: 50%;
    right: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8d929c;
    transform: translateY(-50%);
    cursor: pointer;
}

.login-modal__error {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    color: #b0241c;
    font-size: 12px;
    font-weight: 700;
    background: rgba(240, 82, 69, 0.1);
    animation: shake 0.32s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

.login-modal__submit {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 46px;
    margin-top: 4px;
    border: none;
    border-radius: 14px;
    color: #fff;
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 0.02em;
    background: linear-gradient(135deg, #73b7ff 0%, #357df4 58%, #275bd8 100%);
    box-shadow: 0 12px 24px rgba(53, 125, 244, 0.28),
                inset 0 1px 0 rgba(255, 255, 255, 0.36);
    cursor: pointer;
    transition: transform 0.14s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}

.login-modal__submit::after {
    display: none;
}

.login-modal__submit:active:not(:disabled) {
    transform: scale(0.985);
    box-shadow: 0 6px 14px rgba(53, 125, 244, 0.24),
                inset 0 1px 0 rgba(255, 255, 255, 0.36);
}

.login-modal__submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.login-modal__submit--loading {
    opacity: 0.85;
}

.login-modal__foot {
    margin-top: 2px;
    color: #8a8f99;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
}

.login-modal__link {
    color: #357df4;
    font-weight: 800;
    cursor: pointer;
}

.login-modal__link:active {
    color: #275bd8;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes modalIn {
    from {
        opacity: 0;
        transform: translateY(16px) scale(0.96);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

@keyframes shake {
    10%, 90% { transform: translateX(-1px); }
    20%, 80% { transform: translateX(2px); }
    30%, 50%, 70% { transform: translateX(-3px); }
    40%, 60% { transform: translateX(3px); }
}
</style>
