# @webassemblyjs/ast 工具函数 — 总结文档 [VJMW7t]

对用户提供的 `<content>`（WebAssembly JS AST 辅助与工具函数）的简明总结。

## 结构
- 前半：Babel 运行时辅助（_slicedToArray、_nonIterableRest、_unsupportedIterableToArray、_arrayLikeToArray、_iterableToArrayLimit、_arrayWithHoles、_typeof）。
- 后半：ES module 导入（./signatures、./traverse、@webassemblyjs/helper-wasm-bytecode），以及多个 export 函数。

## 要点
- **节与元数据**：isAnonymous；getSectionMetadata/getSectionMetadatas（traverse 取 SectionMetadata）；sortSectionMetadata（按 constants.sections 排序）；getEndOfSection。
- **节点与位置**：assertHasLoc；orderedInsertNode（按 loc 有序插入，ModuleExport 直接 push）；shiftLoc/shiftSection（偏移与 section 内节点位置）。
- **字节偏移**：getStartByteOffset/getEndByteOffset；getFunctionBeginingByteOffset（首条指令）；getEndBlockByteOffset/getStartBlockByteOffset（块首/块末指令）。
- **其它**：signatureForOpcode（从 signatures 取 opcode 签名）；getUniqueNameGenerator（前缀+递增唯一名）。

## 用途
为 @webassemblyjs 提供 WASM AST 的节元数据访问、节点有序插入、位置与字节偏移计算、opcode 签名及唯一命名等，供解析与转换 WebAssembly 使用。
