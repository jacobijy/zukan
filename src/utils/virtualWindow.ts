/**
 * 虚拟列表窗口计算（纯算术，无 DOM / Vue 依赖）
 *
 * 抽出来是为了能独立测试 —— 窗口计算的 off-by-one 和边界越界是虚拟滚动最容易
 * 出错的地方，而这类错误在组件里只表现为"某些位置漏一行"或"滚到底缺最后几条"，
 * 靠肉眼很难稳定复现。`VirtualGrid.vue` 只负责把 DOM 几何喂进来、把结果贴回样式。
 *
 * ## 前提：定高
 * 图鉴卡片高度在每个断点内恒定（实测 98px @ mobile / 106px @ ≥640px，
 * 名称是 `truncate` 单行、属性徽章纵向排列不影响高度），因此不需要逐项测量。
 * 若将来 `PokemonCard` 改成多行标题或可变高度，这套算法的前提就不成立了。
 */

export interface VirtualWindowInput {
    /** 滚动容器当前 scrollTop */
    scrollTop: number;
    /** 滚动容器可视高度 */
    viewportHeight: number;
    /** 数据总条数 */
    total: number;
    /** 当前列数（从 computed style 读，≥1） */
    columns: number;
    /** 单张卡片高度（同一断点内恒定） */
    cardHeight: number;
    /** 行间距（grid 的 rowGap） */
    rowGap: number;
    /** 视口外额外渲染的行数，避免滚动时露白。默认 2 */
    overscan?: number;
}

export interface VirtualWindowResult {
    /** 窗口首行（含），0-based */
    firstRow: number;
    /** 窗口末行（含）。total=0 时为 -1 */
    lastRow: number;
    /** 窗口内首个 item 下标（含） */
    firstIndex: number;
    /** 窗口内末个 item 下标（含）。total=0 时为 -1 */
    lastIndex: number;
    /** 内层 grid 相对 spacer 顶部的偏移，等于 firstRow * rowPitch */
    offsetTop: number;
    /** spacer 总高 = 完整列表铺开后的高度 */
    spacerHeight: number;
    /** 总行数 */
    totalRows: number;
}

/**
 * 算出当前应渲染的窗口。
 *
 * 约定：
 * - `spacerHeight = rows * (cardHeight + gap) - gap` —— **末行不占行间距**，
 *   否则列表底部会多出 gap 高的空白，滚动条也会比实际内容长一截。
 * - 越界一律 clamp，不抛错：`scrollTop` 在弹性滚动（iOS 橡皮筋）下可能为负或
 *   超过最大值，此时应回退到首屏 / 末屏而不是渲染出负下标。
 */
export function computeVirtualWindow(input: VirtualWindowInput): VirtualWindowResult {
    const { scrollTop, viewportHeight, total, cardHeight, rowGap } = input;
    const overscan = input.overscan ?? 2;
    // 列数至少 1，否则 ceil(total/0) = Infinity
    const columns = Math.max(1, Math.floor(input.columns) || 1);
    const rowPitch = cardHeight + rowGap;

    if (total <= 0 || cardHeight <= 0) {
        return {
            firstRow: 0,
            lastRow: -1,
            firstIndex: 0,
            lastIndex: -1,
            offsetTop: 0,
            spacerHeight: 0,
            totalRows: 0,
        };
    }

    const totalRows = Math.ceil(total / columns);

    // 末行不再占一份行间距，否则列表底部会多出 gap 高的空白
    const spacerHeight = totalRows * rowPitch - rowGap;

    // 负 scrollTop（橡皮筋）当作 0
    const safeScrollTop = Math.max(0, scrollTop);
    const safeViewport = Math.max(0, viewportHeight);

    const firstVisibleRow = Math.floor(safeScrollTop / rowPitch);
    const lastVisibleRow = Math.ceil((safeScrollTop + safeViewport) / rowPitch);

    const firstRow = Math.max(0, Math.min(totalRows - 1, firstVisibleRow - overscan));
    const lastRow = Math.min(totalRows - 1, Math.max(firstRow, lastVisibleRow + overscan));

    const firstIndex = firstRow * columns;
    // 末行可能不满，故与 total-1 取小
    const lastIndex = Math.min(total - 1, (lastRow + 1) * columns - 1);

    return {
        firstRow,
        lastRow,
        firstIndex,
        lastIndex,
        offsetTop: firstRow * rowPitch,
        spacerHeight,
        totalRows,
    };
}
