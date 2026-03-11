# Reflect.getPrototypeOf 模块 — 总结文档 [EgFRKZ]

对用户提供的 `<content>`（Reflect.getPrototypeOf polyfill/shim）的简明总结。

## 结构
注释：26.1.8 Reflect.getPrototypeOf(target)。require：./_export、./_object-gpo（getProto）、./_an-object。$export($export.S, 'Reflect', { getPrototypeOf: function(target) { return getProto(anObject(target)); } })。

## 要点
- 在 Reflect 上挂载 getPrototypeOf；实现为先对 target 调用 anObject（类型校验），再传 getProto 获取原型。
- 对应 ES 规范 26.1.8；$export.S 表示静态方法导出。
- 用于不支持原生 Reflect.getPrototypeOf 的环境（如旧版浏览器或 Node）的补丁。

## 用途
作为 Reflect.getPrototypeOf 的 polyfill/shim，保证在目标环境中可安全获取对象原型。
