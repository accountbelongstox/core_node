# call-bind-apply-helpers package.json — 总结文档

对用户提供的 `<content>`（call-bind-apply-helpers 的 package.json）的简明总结。

## 结构
- 根对象含：name、version、description、main、exports（主入口及 actualApply、applyBind、functionApply、functionCall、reflectApply、package.json）、scripts、repository、author、license、bugs、homepage、dependencies、devDependencies、testling、auto-changelog、publishConfig、engines。

## 要点
- **name**：call-bind-apply-helpers。**version**：1.0.2。**description**：围绕 Function call/apply/bind 的辅助函数，供 call-bind 使用。
- **exports**：主入口 index.js 及多个子路径（actualApply、applyBind、functionApply、functionCall、reflectApply）。**scripts**：prepack、prepublish、lint、test、version/postversion 等，含 eslint、tsc、attw、nyc、tape、auto-changelog。
- **dependencies**：es-errors、function-bind。**engines**：node >= 0.4。**author**：Jordan Harband。**license**：MIT。

## 用途
定义 npm 包 call-bind-apply-helpers 的元数据、入口、脚本与依赖，供安装、引用及开发/测试/发布使用。
