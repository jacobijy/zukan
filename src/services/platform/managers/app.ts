import { BasePlatformManager } from './base';

/**
 * App（5+App，Android/iOS）管理对象基类：承载 App 侧共性、作为两端共同父类。
 * 当前登录/绑定逻辑已全部由 BasePlatformManager 覆盖；以后 App 特有共性
 * （支付、推送、分享、`plus.io` 读 wasm 字节等）加在这里、两端共享，
 * 仅一端的差异在 AppIosManager / AppAndroidManager 中重写。
 */
export abstract class AppManager extends BasePlatformManager {}
