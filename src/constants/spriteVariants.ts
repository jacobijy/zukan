/**
 * 宝可梦立绘 variant 的单一数据源。
 *
 * 服务器（`assets/encrypted-assets/pokemon/<id>/<variant>.bin`）为每个 id 提供
 * 多个 variant，尺寸与体积差了两个数量级：
 *
 * | variant | 明文尺寸 | 密文均值 | 覆盖（数字 id） |
 * |---------|---------|---------|----------------|
 * | `front` | 96×96 像素图 | **1.9 KB** | 1341 |
 * | `home` | 512×512 渲染图 | 122 KB | 1336 |
 * | `artwork` | 475×475 官方插画 | 124 KB | 1339 |
 *
 * 由此有两条策略，常量都收敛在本文件（组件不各写一份）：
 *
 * 1. **渐进式两段加载**：先拉 `front` 点亮整屏（一屏 20 张约 38 KB），
 *    再后台换高清。首屏出图从"等两百多 KB"变成"等 2 KB"。
 * 2. **回落链**：`home` 并非人人都有——数字 id 里有 10 个缺 `home`，其中 8 个
 *    （10080–10085 角色扮演皮卡丘、10158/10159 搭档皮卡丘/伊布）有 `artwork`
 *    可用。逐个试比直接落占位图强。真正三者皆无的只剩 10264 / 10268。
 *
 * 数据层的 `hasSprite`（PKMB `PokemonBase` 字段，口径 = artwork/home/shiny 任一
 * 存在）可在发请求前就判定必然失败的形态，见 `docs/data/bundle-decode.md`。
 */

/** 渐进式加载的低清先行图。96×96，约 2 KB，几乎瞬时到达。 */
export const SPRITE_PREVIEW = 'front';

/**
 * 主 variant 404 时的回落顺序（不含主 variant 自身）。
 *
 * `artwork` 在前：它和 `home` 同为高清渲染/插画，画风与尺寸接近，替换上去不突兀；
 * `front` 垫底：像素图画风不同，但有总比灰占位好。
 */
export const SPRITE_FALLBACKS: readonly string[] = ['artwork', SPRITE_PREVIEW];

/**
 * 构造「主 variant + 回落」的尝试顺序，去重且保持首项为主 variant。
 *
 * 去重是必要的：详情页可能直接传 `variant="artwork"`，不去重的话链里会出现
 * 两次 artwork——第一次 404 后又白试一次，多一个 404 往返。
 */
export function buildSpriteChain(variant: string, fallbacks: readonly string[] = SPRITE_FALLBACKS): string[] {
    const chain: string[] = [variant];
    for (const f of fallbacks) {
        if (!chain.includes(f)) chain.push(f);
    }
    return chain;
}
