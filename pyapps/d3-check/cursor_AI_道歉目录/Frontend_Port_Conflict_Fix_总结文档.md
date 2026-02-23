# Frontend Port Conflict Fix 总结文档

对用户提供的《Frontend Port Conflict Fix》的简明总结。

## 结构
- 问题根本原因（三点）、修复方案（五处）、端口分配表、测试验证、其他修复（THREAD_BUS、pyc 清理）、总结。

## 要点
- **原因**：matrixui 占 3000，pycore-management 也配 3000 → 冲突；Vite 端口被占时自动递增到 3002/3003，frontend_thread 仍等 localhost:3000 → 无限等待；无超时；进程可 defunct。
- **修复**：config.py FRONTEND_PORT=3100；vite.config.ts 默认端口 3100、strictPort:true；frontend_thread.py 设置 VITE_PORT、VITE_HOST；audio_capture.py 在清空 _frames 前先根据帧数计算 duration。
- **端口**：matrixui 3000，pycore-management 3100，RPC 59000。

## 用途
记录 pycore_module_caller 卡在等待 3000 的原因与解决步骤，便于后续排查与验证。
