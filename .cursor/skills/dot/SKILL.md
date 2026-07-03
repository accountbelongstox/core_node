---
name: dot
description: When working on dotcore (shared .NET libs = public class libraries = pycore counterpart) or dotapps (runnable apps), follow layout, naming, and dependency rules. All shared libraries live in dotcore; apps reference only dotcore.
---

# Dot Stack 规范

- 共享代码只放 dotcore/DotCore.<Name>；单 App 专属库放 dotapps/<AppName>/<SubLib>，禁止放进 dotcore；dotapps 下每个子目录是一个可运行 App。
- 依赖方向：App → Library 单向，Library 之间禁止成环；App 之间禁止互相引用。
- 命名：库用 DotCore.<Name>（命名空间 DotCore.*）；App 文件夹/程序集同名，命名空间 DotApps.<AppName>。
- 代码/注释/用户可见字符串一律英文，且仅用 ASCII。
- 新增库/App 必须加入 dotcore/dotcore.sln。
- 构建：dotnet build dotcore/dotcore.sln。
