import { AppManager } from './app';

/** iOS App 管理对象。Sign in with Apple 等仅 iOS 的能力在此扩展/重写。 */
export class AppIosManager extends AppManager {
    constructor() {
        super('app-ios');
    }
}
