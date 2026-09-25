import { detectPlatform, type Platform } from '@/infra/platform';
import { AppAndroidManager } from './appAndroid';
import { AppIosManager } from './appIos';
import { H5Manager } from './h5';
import { MpWeixinManager } from './mpWeixin';
import type { PlatformManager } from './types';
import { UnknownManager } from './unknown';

/** 按平台标识创建对应管理对象。 */
function createManager(platform: Platform): PlatformManager {
    switch (platform) {
        case 'h5':
            return new H5Manager();
        case 'mp-weixin':
            return new MpWeixinManager();
        case 'app-ios':
            return new AppIosManager();
        case 'app-android':
            return new AppAndroidManager();
        default:
            return new UnknownManager();
    }
}

/** 单例缓存：同平台全局复用一个管理对象。 */
const instances = new Map<Platform, PlatformManager>();

/**
 * 获取当前平台的管理对象（单例）。显式传 platform 便于 node 单测驱动；
 * 缺省由 detectPlatform() 探测。
 */
export function getPlatformManager(platform: Platform = detectPlatform()): PlatformManager {
    let manager = instances.get(platform);
    if (!manager) {
        manager = createManager(platform);
        instances.set(platform, manager);
    }
    return manager;
}
