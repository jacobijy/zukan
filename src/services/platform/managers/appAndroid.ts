import { AppManager } from './app';

/** Android App 管理对象。Android 侧特有操作在此扩展/重写。 */
export class AppAndroidManager extends AppManager {
    constructor() {
        super('app-android');
    }
}
