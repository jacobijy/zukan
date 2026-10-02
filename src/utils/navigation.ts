/**
 * 跨页面跳转工具：目标是 tabBar 页时走 `switchTab`（保活），否则 `navigateTo`。
 *
 * tab 路径须与 `pages.json` 的 `tabBar.list` 保持一致；判断时取去掉 query 后的路径。
 */
const TAB_PATHS = [
    '/pages/index/index',
    '/pages/features/features',
    '/pages/data/data',
    '/pages/mine/mine',
] as const

/** 判断 url（可带 query）是否指向 tabBar 页 */
export function isTabPath(url: string): boolean {
    const path = url.split('?')[0]
    return (TAB_PATHS as readonly string[]).includes(path)
}

/** 按目标自动选择 `switchTab`（tab 页）或 `navigateTo`（普通子页） */
export function navigateToAuto(url: string): void {
    if (isTabPath(url)) {
        uni.switchTab({ url })
    } else {
        uni.navigateTo({ url })
    }
}
