/**
 * 微信等小程序端关闭 preflight：preflight 是给 H5 的 html/body 文档做的 reset，
 * 内含小程序不支持的 `:host` / `::backdrop` / `:where()` 选择器，会在微信开发者工具
 * 控制台报 WXSS 错误（小程序也没有 html/body 元素）。H5 保持默认开启。
 * uni-app 构建时注入 process.env.UNI_PLATFORM（h5 / mp-weixin / ...）。
 *
 * 另外小程序端开启 experimental.optimizeUniversalDefaults：只要用到 transform / ring /
 * filter 等工具类，Tailwind 默认会注入 `*,::before,::after{--tw-*…}` 和
 * `::backdrop{…}` 两段"变量默认值"（独立于 preflight），其中通用选择器 `*` 与
 * `::backdrop` 在微信 WXSS 同样报错。开启优化后默认值被收敛到实际使用工具类的
 * class 选择器上，`*` 与 `::backdrop` 都不再生成。注意该开关在 Tailwind v3 里属于
 * experimental 而非 future。H5 维持默认行为不动。
 */
const isMiniProgram = (process.env.UNI_PLATFORM || '').startsWith('mp-');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  corePlugins: {
    preflight: !isMiniProgram,
  },
  ...(isMiniProgram ? { experimental: { optimizeUniversalDefaults: true } } : {}),
  theme: {
    extend: {
      colors: {
        // 宝可梦类型颜色
        'type-normal': '#A8A77A',
        'type-fire': '#EE8130',
        'type-water': '#6390F0',
        'type-electric': '#F7D02C',
        'type-grass': '#7AC74C',
        'type-ice': '#96D9D6',
        'type-fighting': '#C22E28',
        'type-poison': '#A33EA1',
        'type-ground': '#E2BF65',
        'type-flying': '#A98FF3',
        'type-psychic': '#F95587',
        'type-bug': '#A6B91A',
        'type-rock': '#B6A136',
        'type-ghost': '#735797',
        'type-dragon': '#6F35FC',
        'type-dark': '#705746',
        'type-steel': '#B7B7CE',
        'type-fairy': '#D685AD',
      },
    },
  },
  plugins: [],
}
