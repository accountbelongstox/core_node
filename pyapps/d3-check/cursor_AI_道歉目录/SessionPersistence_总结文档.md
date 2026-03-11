# SessionPersistence 模块 — 总结文档

对用户提供的 `<content>`（SessionPersistence 源码）的简明总结。

## 结构
- 单文件 Node 类 `SessionPersistence`，依赖 `fs`、`path`、`logger`、`#@ncore/foundation/common/system_paths.js`。
- 构造函数接收 `profileName`，通过 `systemPaths` 得到 sessionDir、userDataDir、cookiesPath、localStoragePath、sessionStatePath；另有 autoSave 相关字段及 page/browser 引用。
- 方法分组：Cookies（save/load）、LocalStorage（save/load）、SessionState（save/load）、saveAll/loadAll、startAutoSave/stopAutoSave、getLastUrl、clearAll、cleanup。

## 要点
- **会话数据**：管理 Cookies、LocalStorage、SessionState（lastUrl、lastTitle、timestamp、profileName），路径均由 systemPaths 按 profile 提供。
- **Puppeteer 集成**：getUserDataDir()、setPageAndBrowser(page, browser)；各 save/load 支持传入 page 或使用内部 this.page。
- **自动保存**：startAutoSave(page?, intervalMs?)、stopAutoSave()，默认 5000ms 间隔调用 saveAll。
- **生命周期**：clearAll() 删除所有持久化文件；cleanup() 停止自动保存并清空 page/browser 引用。

## 用途
为 Puppeteer 等浏览器自动化场景提供会话持久化：保存与恢复 cookies、localStorage、最后打开页面与窗口状态，便于断点续用或复用登录态；支持多 profile 与定时自动保存。
