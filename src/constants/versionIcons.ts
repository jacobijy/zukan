/**
 * PokeAPI `version_id` → HOME 软件作品图标的映射（详情页图鉴描述的版本标签）。
 *
 * 图鉴描述（species flavor）每行带一个 PokeAPI `version_id`；详情页用对应游戏的
 * 软件图标当版本切换标签。HOME 的 softwareicon 图集只覆盖 3DS/Switch 时代
 * （X/Y 起），gen1–5（红/蓝/金/银/宝石/珍钻/黑白…）没有图标，故**只登记有图标的
 * 正作版本**；图标、切片与文件清单见 docs/ui/software-icons.md。
 *
 * 图本身不加密、随包发布，**不走** ZKDX / resourceManager / imageCache，
 * 直接拼 `/static/img/software-icons/...` 绝对路径。
 *
 * version_id 以服务端 `versions.csv` 为准（不是凭记忆）：
 * - 35/36、50/51 是剑盾 DLC（铠之孤岛/冠之雪原），42/43、52/53 是朱紫 DLC，
 *   44–46 是红绿蓝 VC，48/49 是其它——均无独立图标，不在此表；DLC 物种的
 *   species 描述归在主版本（剑盾 33/34、朱紫 40/41），无需 DLC 图标。
 * - 37/38 是 BD/SP，47 是《Z-A》（游戏解包追加，当前 flavor 数据未必已有，
 *   先登记，数据出现即可显示）。
 */

/** 软件图标静态根目录（与 `/static/default.png` 同样的绝对路径口径） */
export const SOFTWARE_ICON_BASE = '/static/img/software-icons';

/**
 * PokeAPI version_id → 图标文件名片段（`PokeTitle_S_<code>.png`）。
 * 仅含有软件图标的正作版本。
 */
export const VERSION_ICON_BY_VERSION: Readonly<Record<number, string>> = {
    23: '101_X',
    24: '101_Y',
    25: '102_OR',
    26: '102_AS',
    27: '103_Sun',
    28: '103_Moon',
    29: '104_US',
    30: '104_UM',
    31: '105_P',
    32: '105_E',
    33: '106_SW',
    34: '106_SH',
    37: '107_BD',
    38: '107_SP',
    39: '108_LA',
    40: '109_SV_S',
    41: '109_SV_V',
    47: '110_LZA',
};

/** 某版本是否有软件图标 */
export const hasVersionIcon = (versionId: number): boolean =>
    Object.prototype.hasOwnProperty.call(VERSION_ICON_BY_VERSION, versionId);

/** 拼某版本对应图标的静态绝对路径；该版本无图标时返回 undefined。 */
export const versionIconPath = (versionId: number): string | undefined => {
    const code = VERSION_ICON_BY_VERSION[versionId];
    return code ? `${SOFTWARE_ICON_BASE}/PokeTitle_S_${code}.png` : undefined;
};

/** 版本图标标签：版本号 + 图标路径 */
export interface VersionIconOption {
    version: number;
    iconPath: string;
}

/**
 * 从某实体「有描述的版本集合」里挑出**有软件图标**的版本作为标签，按 version 升序。
 *
 * 入参只取 `{version}` 结构（不依赖 flavor 类型），因此纯函数可在 node 用例直接跑。
 * 老版本（gen1–5）与 DLC 版本无图标，自然被滤掉。
 */
export const iconFlavorOptions = (versions: readonly { version: number }[]): VersionIconOption[] =>
    versions
        .filter((v) => hasVersionIcon(v.version))
        .slice()
        .sort((a, b) => a.version - b.version)
        .map((v) => ({ version: v.version, iconPath: versionIconPath(v.version)! }));
