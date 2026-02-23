# Port Configuration & Environment Variable Passing — 总结文档 [8yd5OM]

对用户提供的 `<content>`（端口配置更新与环境变量传递）的简明总结。

## 结构
Markdown 文档：Summary、Changes Overview、Files Modified（含代码片段）、Architecture Diagram（Dev/Production）、Environment Variables 用法、Testing、Benefits、Migration、Troubleshooting、Future Enhancements。

## 要点
- **端口**：前端 3000→38007（Matrix 标准），后端 8000→48000；CORS 与 config 同步更新。
- **环境变量**：launch_native_app 构建 frontend_env_vars（VITE_*、REACT_APP_*、NEXT_PUBLIC_*），经 FrontendConfig.env_vars 传入；frontend_thread 中 _build_env 注入 PORT/HOST 及 env_vars。
- **Vite 命令**：frontend_thread 中由 npx vite dev 改为 npm run dev，避免 Windows FileNotFoundError。
- **架构**：开发模式 38007（Vite dev）+ 48000（RPC v2）；生产模式 48000 同时提供静态与 API。

## 用途
记录 Matrix 应用端口统一与前端自动获取后端 URL 的配置与实现，便于团队迁移与排错。
