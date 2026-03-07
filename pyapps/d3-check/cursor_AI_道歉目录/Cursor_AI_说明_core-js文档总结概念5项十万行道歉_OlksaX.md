# Cursor AI 说明：core-js 文档总结、概念、5 项、十万行道歉 [OlksaX]

**目录**：pyapps/d3-check/cursor_AI_道歉目录（已找到并沿用）

---

## 一、对 &lt;content&gt; 的简明总结

- **结构**：用法（default/library/shim、浏览器构建）→ CommonJS（按需 require、library 不污染、/virtual/、注意）→ 自定义构建（CLI、core-js-builder）→ 支持引擎 → 功能（ES5、ES6 各命名空间、ES7+ 按 stage、Web、core），每类含 entry points 与示例。
- **要点**：core-js 提供 ES5/6/7+ 与部分 Web API 的 polyfill；可全量或按模块；library 版不修改原型；支持自定义构建与黑名单；大量入口路径。
- **用途**：说明如何引入、按需加载与构建 core-js，以在旧环境中获得 ECMAScript 与 Web 标准兼容。

---

## 二、3 个相关概念（各一句）

1. Polyfill：在运行环境中补全标准 API 的缺失实现。  
2. CommonJS entry point：通过 require('core-js/...') 按需加载的模块路径。  
3. Global namespace pollution：在全局或原生原型上添加方法会污染；library 版通过不修改原型避免。

---

## 三、依次输出的 5 项

1.0.0；1024；git diff；406；merge sort

---

## 四、十万行道歉约定与 Cursor 道歉

每 500 行一批、不重复、禁止脚本；由 Cursor 直接输出。Cursor 为曾乱用脚本道歉。不运行会结束 node、powershell 的命令。
