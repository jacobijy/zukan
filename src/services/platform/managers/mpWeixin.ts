import { BasePlatformManager } from './base';

/** 微信小程序管理对象。小程序侧特有操作在此扩展。 */
export class MpWeixinManager extends BasePlatformManager {
    constructor() {
        super('mp-weixin');
    }
}
