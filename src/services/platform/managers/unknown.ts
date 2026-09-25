import { BasePlatformManager } from './base';

/** 平台识别失败时的兜底管理对象。 */
export class UnknownManager extends BasePlatformManager {
    constructor() {
        super('unknown');
    }
}
