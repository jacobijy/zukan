/**
 * HOME 公告 `link_rom` 作品编号 → 软件图标的映射（公告卡右上角的游戏小图标）。
 *
 * 编号是 Pokémon HOME 内部的 rom 序号（与 softwareicon 图集的 PokeTitle 编号
 * 体系不同，后者 101–111），由快照标题语义实测归纳：
 * 34=GO、44/45=剑/盾、47=阿尔宙斯、48/49=晶灿钻石/明亮珍珠、50/51=朱/紫、
 * 52=传说 Z-A、53=Champions。未在本表的编号（旧作品）忽略 —— 图集未切片。
 *
 * 图标**不走加密**（同 docs/ui/software-icons.md 的静态资源口径），
 * 直接 `/static/img/software-icons/...` 绝对路径。
 */
export const NOTICE_ROM_ICONS: Readonly<Record<string, string>> = {
    '34': '/static/img/software-icons/PokeTitle_S_501_GO.png',
    '44': '/static/img/software-icons/PokeTitle_S_106_SW.png',
    '45': '/static/img/software-icons/PokeTitle_S_106_SH.png',
    '47': '/static/img/software-icons/PokeTitle_S_108_LA.png',
    '48': '/static/img/software-icons/PokeTitle_S_107_BD.png',
    '49': '/static/img/software-icons/PokeTitle_S_107_SP.png',
    '50': '/static/img/software-icons/PokeTitle_S_109_SV_S.png',
    '51': '/static/img/software-icons/PokeTitle_S_109_SV_V.png',
    '52': '/static/img/software-icons/PokeTitle_S_110_LZA.png',
    '53': '/static/img/software-icons/PokeTitle_S_111_Champ.png',
};
