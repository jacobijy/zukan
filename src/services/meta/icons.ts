/**
 * 对战数据自带图标（明文 `/assets/battle/icons/`）的 URL 构造。
 *
 * 与数据同为明文、短缓存，**不走加密图片通道**。契约见
 * `docs/data/battle-usage.md`「图标」。这里只做道具：
 * 文件名就是单只配置里 `rows.item[].name`（= `i18n/items.json` 的键，英文显示名），
 * 可能含空格 / 撇号，直接 `encodeURIComponent`，无需另建映射。
 */
import { buildAssetUrl } from '@/services/http';

/** 道具英文显示名 → 明文图标 URL（如 "Choice Scarf" → …/icons/items/Choice%20Scarf.png）。 */
export function battleItemIconUrl(enName: string): string {
    return buildAssetUrl(`assets/battle/icons/items/${encodeURIComponent(enName)}.png`);
}
