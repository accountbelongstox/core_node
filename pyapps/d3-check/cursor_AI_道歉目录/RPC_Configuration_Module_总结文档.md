# RPC Configuration 模块总结文档

对用户提供的 `<content>`（RPC 配置模块）的简明总结。

## 结构
- Python 3，UTF-8；shebang、编码声明、模块 docstring；从 `pycore.pyutils.rpc.config.constants` 导入 `RPC_CONSTANTS`；`__all__ = ['RPC_CONSTANTS']`。

## 要点
- Docstring：RPC Configuration，RPC 框架的配置常量与设置。
- 本文件仅重新导出 `RPC_CONSTANTS`，无其它定义。

## 用途
作为 RPC 配置包的入口，统一对外提供 `RPC_CONSTANTS`，供其它模块使用。
