# differenceInMonths FP 模块 — 总结文档 [tIJjGn]

对用户提供的 `<content>`（differenceInMonths 的 FP 封装）的简明总结。

## 结构
- 注释：本文件由 scripts/build/fp.ts 自动生成，请勿手改。
- 导入：differenceInMonths as fn（../differenceInMonths.js）、convertToFP（./_lib/convertToFP.js）。
- export const differenceInMonths = convertToFP(fn, 2)；export default differenceInMonths（fallback for modularized imports）。

## 要点
- 用 convertToFP(fn, 2) 将两参数函数转为 FP 风格（通常为柯里化或参数顺序固定），便于按需引用与 tree-shaking。

## 用途
作为 date-fns 等库中 differenceInMonths 的 FP 子路径导出，供函数式编程风格调用。
