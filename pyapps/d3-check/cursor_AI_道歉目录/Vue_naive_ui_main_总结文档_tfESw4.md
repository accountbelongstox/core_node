# Vue + naive-ui 入口 — 总结文档 [tfESw4]

对用户提供的 `<content>`（Vue 3 入口 + naive-ui 注册）的简明总结。

## 结构
import from naive-ui（create 及 NAlert、NButton、NCard、NCheckbox、NCollapse、NConfigProvider、NDialogProvider、NForm、NInput、NModal、NMessageProvider、NNotificationProvider、NSpace、NSpin、NSteps、NSwitch、NTabs、NTooltip、NIcon、NImage、NGrid、NTag、NSkeleton、NProgress、NRadio 等）；import createApp from vue；import App.vue、virtual:uno.css、style.css；create({ components: [...] }) 创建 naive 插件；createApp(App).use(naive).mount('#app')。

## 要点
- naive-ui 为 Vue 3 的 UI 组件库，通过 create 批量注册 N* 组件。
- UnoCSS（virtual:uno.css）提供原子化 CSS；style.css 为自定义样式。
- 入口将 App 挂载到 #app。

## 用途
作为 Vue 3 应用的入口，完成 naive-ui 与 UnoCSS 的初始化及根组件挂载。
