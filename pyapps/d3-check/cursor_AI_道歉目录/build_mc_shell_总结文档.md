# build mc shell 脚本 — 总结文档

对用户提供的 `<content>`（ManageCenter 构建脚本）的简明总结。

## 结构
- shebang `#!/bin/sh`；echo 开始/结束分隔线；rm -rf ../bin/pyManageCenter；python3 CompilePy3Pyc.py 两参数（源目录、目标目录）|| exit 1；cp -f ../src/ManageCenter/*.py ../bin/ || exit 2。

## 要点
- **清理**：删除 ../bin/pyManageCenter 目录。
- **编译**：CompilePy3Pyc.py 将 ../src/ManageCenter/pyManageCenter/ 编译输出到 ../bin/pyManageCenter/，失败则 exit 1。
- **复制**：将 ../src/ManageCenter/*.py 复制到 ../bin/，失败则 exit 2。
- 脚本用于“build mc”（ManageCenter）的自动化构建。

## 用途
在 shell 中一键完成 ManageCenter 的编译（py→pyc/产物）与入口脚本复制，供部署或本地运行使用。
