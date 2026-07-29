import '@/static/styles/global.css';
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue';
import { createPinia } from 'pinia';
import { createSSRApp } from 'vue';
import App from './App.vue';
export function createApp() {
    const app = createSSRApp(App);
    const pinia = createPinia();
    app.use(pinia);
    app.component('uni-icons', UniIcons);
    return {
        app,
    };
}
