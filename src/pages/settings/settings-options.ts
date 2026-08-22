/**
 * 设置页行元数据。纯静态结构（图标名 / 配色 / 对应弹层 key），
 * 运行时的标题、副标题、当前值在 settings.vue 里经 i18n + store 解析。
 *
 * 后续新增设置项：在此追加一条 `SettingRowKey`，并在页面里补
 * 对应的 sheet 状态、选项 computed 与 onRowTap 分支即可。
 */

export type SettingRowKey = 'uiLanguage' | 'contentLanguage';

export interface SettingRowMeta {
    key: SettingRowKey;
    /** 与模板里 `#icon` slot 的 v-if 分支对应 */
    icon: 'globe' | 'book';
    /** global.css 里的 .list-row__icon--* 配色 */
    iconClass: string;
}

export const SETTING_ROWS: readonly SettingRowMeta[] = [
    { key: 'uiLanguage', icon: 'globe', iconClass: 'list-row__icon--blue' },
    { key: 'contentLanguage', icon: 'book', iconClass: 'list-row__icon--violet' },
];
