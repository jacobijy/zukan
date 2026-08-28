/**
 * 加密图片资源的「种类」描述符。
 *
 * 宝可梦立绘与道具图标走同一条下载 / 解密 / 缓存管线（见 `imageCache.ts` /
 * `imagePersist.ts`），差别只在三处，收敛到这里，引擎本身与种类无关：
 *
 * 1. **远端路径**：pokemon 是 `<id>/<variant>.bin`（一物种多变体），
 *    item 是扁平的 `<id>.bin`（一道具一图）。与 zukan-server
 *    `assets/encrypted-assets/` 下的目录层级一一对应（pokemon/ 与 items/）。
 * 2. **MIME**：解密后都是 PNG，Blob 用它标注。
 * 3. **持久化 key 前缀**：两类各自独立索引 / 预算 / 跨版本清理，互不挤占。
 *    前缀本身已区隔种类，故磁盘 key 不再重复带目录名（保持 pokemon 的
 *    `sprite:v<ver>:<id>/<variant>` 格式不变，避免作废老缓存）。
 */

export type ImageKind = 'pokemon' | 'item';

export interface ImageKindSpec {
    /** 解密后字节的 MIME（当前两类都是 PNG） */
    mime: string;
    /** 持久化 key 公共前缀（不含版本），跨版本清理按此前缀圈定范围 */
    persistRoot: string;
    /** uni storage 里的索引 key（索引小、要同步读，与 IDB 数据分开生命周期） */
    indexStorageKey: string;
    /**
     * 该种类在服务器上的相对资源路径（`buildCdnUrl` 之前）。
     * pokemon 带 variant 子路径，item 忽略 variant（扁平 `<id>.bin`）。
     */
    remotePath: (id: number, variant: string) => string;
}

const POKEMON: ImageKindSpec = {
    mime: 'image/png',
    persistRoot: 'sprite:',
    indexStorageKey: 'zukan_sprite_index',
    remotePath: (id, variant) => `/assets/encrypted/pokemon/${id}/${variant}.bin`,
};

const ITEM: ImageKindSpec = {
    mime: 'image/png',
    // 道具密文另立前缀，与 sprite 预算 / 索引互不影响
    persistRoot: 'item-img:',
    indexStorageKey: 'zukan_item_img_index',
    // 服务器上道具是扁平结构 encrypted-assets/items/<id>.bin（无 variant 子目录）
    remotePath: (id) => `/assets/encrypted/items/${id}.bin`,
};

export const IMAGE_KINDS: Record<ImageKind, ImageKindSpec> = {
    pokemon: POKEMON,
    item: ITEM,
};

export function imageKindSpec(kind: ImageKind): ImageKindSpec {
    return IMAGE_KINDS[kind];
}
