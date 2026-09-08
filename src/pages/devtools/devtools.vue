<template>
    <view class="devtools-page min-h-screen page-bg" :style="{ paddingTop: 'var(--status-bar-height)' }">
        <DetailNavbar title="开发者工具" fallback-url="/pages/mine/mine" />

        <scroll-view
            scroll-y
            class="relative z-10 h-[calc(100vh-var(--status-bar-height))] mt-[calc(var(--status-bar-height)+52px)] px-4 pb-6"
        >
            <view class="mx-auto max-w-[720px] pt-3 pb-10">
                <template v-if="devtoolsEnabled">
                    <view class="devtools-page__tabs">
                        <view
                            v-for="t in TOOLS"
                            :key="t.id"
                            class="devtools-page__tab"
                            :class="{ 'devtools-page__tab--active': t.id === tool }"
                            @click="select(t.id)"
                        >{{ t.label }}</view>
                    </view>

                    <component :is="Impl" v-if="Impl" />
                    <view v-else class="devtools-page__off">
                        <text class="devtools-page__off-hint">载入中…</text>
                    </view>
                </template>

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
 * 实现体（`DevAssetInspector.vue` / `DevTextBrowser.vue`）**只在 dev 被动态 import**：
 * `devtoolsEnabled` 就是 `import.meta.env.DEV`，Vite 把它静态替换成字面量，于是正式
 * 构建里这个 `if` 恒假，Rollup 判定 `import()` 不可达并连整个分包一起丢掉。
 *
 * 工具切换必须**在同一个守卫块里写字面量 `import()`**（见 `mount`）。写成
 * `loaders[id]()` 这种查表、或 `import('./Dev' + id + '.vue')` 这种拼接都不行：
 * 前者要 Rollup 把「守卫恒真 → 表没人引用 → 表里的 import 是死的」这条链推完，
 * 后者干脆让它保守地把整个目录打成分包 —— 两种都可能把 dev-only 代码带进产物。
 *
 * 页壳本身仍留在 `pages.json` 里 —— 静态 JSON 没法按环境条件注册页面。因此正式产物
 * 里这条路由存在但只渲染一句「未启用」，被剔除的是实现体不是路由。真要连路由也去掉，
 * 得上生成 pages.json 的构建步骤，为一个内部工具不值得。
 */
import { onMounted, shallowRef, ref, type Component } from 'vue';
import DetailNavbar from '@/components/shared/DetailNavbar.vue';
import { devtoolsEnabled } from '@/services/devtools/enabled';

type ToolId = 'probe' | 'text';

const TOOLS: readonly { id: ToolId; label: string }[] = [
    { id: 'probe', label: '资源探测器' },
    { id: 'text', label: '文本浏览' },
];

const tool = ref<ToolId>('probe');
// shallowRef 而不是 ref：组件定义对象不需要深度响应，ref 会把它整个 proxy 一遍
const Impl = shallowRef<Component | null>(null);

/** 切工具的请求序号：连点两个 tab 时，先发的加载后到会覆盖掉后选的那个 */
let seq = 0;

async function mount(id: ToolId) {
    const mine = ++seq;
    Impl.value = null;
    if (!devtoolsEnabled) return;
    const mod = id === 'text' ? await import('./DevTextBrowser.vue') : await import('./DevAssetInspector.vue');
    if (mine !== seq) return;
    Impl.value = mod.default;
}

function select(id: ToolId) {
    if (id === tool.value) return;
    tool.value = id;
    void mount(id);
}

onMounted(() => void mount(tool.value));
</script>

<style scoped>
.devtools-page__tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
    padding: 4px;
    border-radius: 14px;
    background: rgba(36, 38, 43, 0.05);
}

.devtools-page__tab {
    flex: 1 1 0;
    padding: 8px 4px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 800;
    color: #6f7682;
    text-align: center;
}

.devtools-page__tab--active {
    color: #ffffff;
    background: linear-gradient(135deg, #ff7a6b 0%, #ef4444 100%);
}

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
