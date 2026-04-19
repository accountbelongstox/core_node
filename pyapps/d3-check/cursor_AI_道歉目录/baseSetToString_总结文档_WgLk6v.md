# baseSetToString 模块 — 总结文档 [WgLk6v]

对用户提供的 `<content>`（baseSetToString 实现）的简明总结。

## 结构
- 导入：constant（./constant.js）、defineProperty（./_defineProperty.js）、identity（./identity.js）。
- baseSetToString：若 !defineProperty 则赋值为 identity；否则为 function(func, string)，内层用 defineProperty(func, 'toString', { configurable: true, enumerable: false, value: constant(string), writable: true })，返回 func。
- export default baseSetToString。
- JSDoc：base implementation of setToString without hot loop shorting；@private；参数 func、string；返回 func。

## 要点
- 环境无 defineProperty 时不做修改，直接返回原函数（identity）。
- 有 defineProperty 时给函数挂载自定义 toString，且 enumerable: false，便于调试又不参与枚举。

## 用途
为函数设置可配置、不可枚举的 toString 返回值，常用于 Lodash 等库的内部基实现（如不含热循环短路逻辑的 setToString）。
