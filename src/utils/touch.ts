/**
 * 遮罩层 touchmove 处理：阻止滚动穿透，但只在事件可取消时 preventDefault。
 *
 * 浏览器在惯性滚动进行中派发的 touchmove 为 cancelable=false，此时调
 * preventDefault 会被忽略并在控制台报 Intervention
 * （Ignored attempt to cancel a touchmove event with cancelable=false）。
 *
 * 小程序端事件对象没有 preventDefault：模板上的 .stop 会被编译成
 * catchtouchmove，本身就是防滚动穿透的标准做法，故此处直接跳过。
 */
export function preventTouchMove(e: Event): void {
    if (e.cancelable !== false && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
}
