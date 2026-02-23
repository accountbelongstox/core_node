# configs JSON 简要总结

对用户提供的 `<content>`（configs 远程配置 JSON）的简要总结。

- **结构**：顶层 `configs` 数组 + `version`。每项含 appName、data、effectStrategy、type、version，部分含 appId、instanceId。
- **要点**：base（策略）、app_block（拦截与 scheme）、ads_block、reading_view、lightning、bingviz、sydchat、discoverchat、add_topsite、app_selfupdate、topsites、dma、darkmode、beta_enrollment、growthEngine（campaigns）。
- **用途**：客户端功能与实验的远程配置。
