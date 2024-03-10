import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import VueDatGui from "@cyrilf/vue-dat-gui";
import "@cyrilf/vue-dat-gui/dist/style.css";

const app = createApp(App);
app.use(VueDatGui);
app.mount("#app");
