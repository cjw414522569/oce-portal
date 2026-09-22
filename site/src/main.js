import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "./styles.css";
import App from "./App.vue";
import i18n from "./i18n";
import { fmtCount } from "./format";

const app = createApp(App).use(i18n).use(ElementPlus);
// 全局模板方法：任何组件模板可直接 {{ fmtCount(n) }}
app.config.globalProperties.fmtCount = fmtCount;
app.mount("#app");
