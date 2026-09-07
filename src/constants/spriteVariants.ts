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
 * 闪光系主 variant 404 时的回落顺序（不含主 variant）。
 *
 * 与 `SPRITE_FALLBACKS` 对称：`home-shiny` 对应 `artwork-shiny`（高清插画）、
 * `shiny`（96×96 像素闪光图）垫底。**刻意不含非闪闪变体** —— 闪光缺失时回落
 * 非闪光是把错的东西显示出来（见注释里的 shiny 段落），整条链都 404 就落占位图。
 */
export const SPRITE_SHINY_FALLBACKS: readonly string[] = ['artwork-shiny', 'shiny'];

/**
 * 性别专属 variant → 它的无性别版本。
 *
 * **`female` 缺失不是资源缺口，而是「该形态不分性别」。** 上游只在雌性外观确实与
 * 默认不同时才产出 `female`（皮卡丘♀尾巴是心形，所以有；妙蛙种子没有），因此
 * 1346 个数字 id 里只有 **103** 个有 `female` / `home-female`。剩下 1243 个的 404
 * 恰恰说明「默认图就是雌性的样子」—— 回落到默认图不是妥协，是**正确答案**。
 * 已核对：有 `female` 的 103 个 id 全部有 `front`，有 `home-female` 的全部有 `home`，
 * 所以这一步回落必然落地（两批 id 不完全重合：902 只有 home-female，10033 只有 female）。
 *
 * **shiny 刻意不这样配对。** 闪光缺失时回落到非闪光是把**错的东西**显示出来
 * （一只闪光宝可梦画成普通配色），而 female 缺失时回落到默认是对的。两者语义不对称，
 * 别顺手加进来。
 */
export const SPRITE_DEGENDERED: Readonly<Record<string, string>> = {
    female: SPRITE_PREVIEW,
    'home-female': 'home',
    // 只有 592 / 593（哎呀水母♀♂差异极大）两个数字 id 有
    'dream-female': 'dream',
};

/**
 * 服务端为每个 id 可能产出的全部 variant（`versions/<gen>/...` 除外，那是按世代的
 * 历史美术，路径带子目录、前端不读）。
 *
 * **只给诊断用**：开发者工具一次扫完，看清某个形态到底有哪几张图 —— 运行时的尝试
 * 顺序由上面的 `SPRITE_PREVIEW` / `SPRITE_FALLBACKS` 决定，不是这张表。两者答的是
 * 不同问题（「有什么」vs「按什么顺序试」），但 variant 名字只在本文件定义一次。
 */
export const SPRITE_VARIANT_CATALOG: readonly string[] = [
    'home',
    'home-shiny',
    'home-female',
    'artwork',
    'artwork-shiny',
    'front',
    'shiny',
    'female',
    'back',
    // dream 系是 **SVG**，不是 PNG（1012 个数字 id）。Blob 的 MIME 按字节嗅探，
    // 写死 image/png 的话浏览器一律不渲染 —— 见 `services/resources/imageMime.ts`
    'dream',
    'dream-female',
];

/**
 * 构造「主 variant + 回落」的尝试顺序，去重且保持首项为主 variant。
 *
 * 性别专属 variant 的无性别版本**插在通用回落之前**：请求 `home-female` 时该先试
 * `home`（同画风同尺寸的同一只），而不是跳到 `artwork`。
 *
 * 去重是必要的：详情页可能直接传 `variant="artwork"`，不去重的话链里会出现
 * 两次 artwork——第一次 404 后又白试一次，多一个 404 往返。
 */
export function buildSpriteChain(variant: string, fallbacks: readonly string[] = SPRITE_FALLBACKS): string[] {
    const chain: string[] = [variant];

    const degendered = SPRITE_DEGENDERED[variant];
    if (degendered && !chain.includes(degendered)) chain.push(degendered);

    for (const f of fallbacks) {
        if (!chain.includes(f)) chain.push(f);
    }
    return chain;
}

/**
 * 详情页 hero 的显示 variant。home 系三选一：
 * 闪光开启时两种性别共显 `home-shiny`（上游没有 `home-shiny-female`，见 catalog）。
 * 纯函数便于 node 单测；组件侧的「固定性别锁定」由调用方把 sex 算好再传进来。
 */
export function heroVariant(shiny: boolean, gender: 'male' | 'female'): string {
    if (shiny) return 'home-shiny';
    return gender === 'female' ? 'home-female' : 'home';
}
