# pycore_module_caller 启动问题修复总结 — 总结文档 [KCvq4o]

对用户提供的 `<content>`（pycore_module_caller.py 启动问题修复总结，2025-12-18）的简明总结。

## 结构
文档分节：问题1（前端启动卡住，端口冲突）及修复1–3；问题2（Frontend 进程 defunct/zombie）及修复4；问题3（Dev 前端被误杀）及修复4；问题4（Tray D-Bus）及修复5；其他修复6–7；端口分配表、完整调用链、测试验证、总结与修复文件列表（8 个文件）。

## 要点
- **端口**：FRONTEND_PORT 3000→3100（避免与 matrixui 冲突）；vite.config 默认 3100、strictPort:true；frontend_thread 传入 VITE_PORT/VITE_HOST。
- **进程 defunct**：subprocess 使用 stdout=PIPE、stderr=STDOUT，后台线程持续消费 stdout，避免管道满/SIGPIPE。
- **Dev 前端误杀**：launch_native_app 仅在 frontend_mode=='production' 时把 frontend_port 加入 ports_to_check，Dev 模式跳过，避免杀掉已启动的 Vite。
- **Tray**：Linux 上 enable_tray=IS_WINDOWS，tray_type="pyside6"。
- **其它**：audio_capture 先 frame_count 再算 duration 再清空 _frames；frontend_thread 增加启动横幅与按关键词彩色输出 Vite 日志。
- **端口分配**：matrixui 3000，pycore-management 3100，RPC v2 59000。

## 用途
记录 pycore_module_caller 与 pycore-management 前端启动、子进程、tray、音频等问题的根因与修改点，便于后续维护与排错。
