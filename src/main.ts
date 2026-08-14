import '@/static/styles/global.css';
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue';
import { createPinia } from 'pinia';
import { createSSRApp } from 'vue';
import { i18n } from '@/services/i18n/ui-i18n';
import App from './App.vue';
export function createApp() {
    const app = createSSRApp(App);
    const pinia = createPinia();
    app.use(pinia);
    app.use(i18n);
    app.component('uni-icons', UniIcons);
    return {
        app,
    };
}
