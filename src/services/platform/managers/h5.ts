import { BasePlatformManager } from './base';

/** H5 管理对象。第三方登录当前由能力矩阵判为无；以后网页扫码等在此扩展。 */
export class H5Manager extends BasePlatformManager {
    constructor() {
        super('h5');
    }
}
