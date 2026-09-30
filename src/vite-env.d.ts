/// <reference types="vite/client" />

declare module '*.vue' {
    import { DefineComponent } from 'vue';
    const component: DefineComponent<{}, {}, any>;
    export default component;
}

// 小程序端全局对象。微信小程序运行时注入 `wx`（uni-app 的 uni 不在此暴露）；
// H5 / App 端是 `uni`（由 uni-app 运行时提供类型）。这里只做最小声明，
// 避免 `typeof wx !== 'undefined'` 触发 TS2304。实际用法都走 `(wx as any)`。
declare const wx: unknown;
