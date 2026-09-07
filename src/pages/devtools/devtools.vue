<template>
    <view class="devtools-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)' }">
        <DetailNavbar title="加密资源探测器" fallback-url="/pages/mine/mine" />

        <scroll-view
            scroll-y
            class="relative z-10 h-[calc(100vh-var(--status-bar-height))] mt-[calc(var(--status-bar-height)+52px)] px-4 pb-6"
        >
            <view class="mx-auto max-w-[720px] pt-3 pb-10">
                <component :is="Impl" v-if="Impl" />
                <view v-else class="devtools-page__off">
                    <text class="devtools-page__off-text">开发者工具未启用</text>
                    <text class="devtools-page__off-hint">仅 `pnpm dev:*` 构建可用</text>
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script lang="ts" setup>
/**
 * 开发者工具页壳。
 *
 * 实现体（`DevAssetInspector.vue`）**只在 dev 被动态 import**：
 * `devtoolsEnabled` 就是 `import.meta.env.DEV`，Vite 把它静态替换成字面量，于是正式
 * 构建里这个 `if` 恒假，Rollup 判定 `import()` 不可达并连整个分包一起丢掉。
 *
 * 页壳本身仍留在 `pages.json` 里 —— 静态 JSON 没法按环境条件注册页面。因此正式产物
 * 里这条路由存在但只渲染一句「未启用」，被剔除的是实现体不是路由。真要连路由也去掉，
 * 得上生成 pages.json 的构建步骤，为一个内部工具不值得。
 */
import { onMounted, shallowRef, type Component } from 'vue';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import { devtoolsEnabled } from '@/services/devtools/enabled';

// shallowRef 而不是 ref：组件定义对象不需要深度响应，ref 会把它整个 proxy 一遍
const Impl = shallowRef<Component | null>(null);

onMounted(async () => {
    if (!devtoolsEnabled) return;
    Impl.value = (await import('./DevAssetInspector.vue')).default;
});
</script>

<style scoped>
.devtools-page__off {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 48px 0;
    text-align: center;
}

.devtools-page__off-text {
    font-size: 14px;
    font-weight: 800;
    color: #6d7380;
}

.devtools-page__off-hint {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    color: #a2a7b2;
}
</style>
