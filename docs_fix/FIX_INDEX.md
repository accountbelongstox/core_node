# FIX 执行索引

| 批次 | 文档 | 约完成度 |
|---|---|---|
| V3 | FIX_V3.md | ✅ 100% |
| V4 | FIX_V4.md | ✅ 100% |
| V5 | FIX_V5.md | ✅ 100% |
| V6 | FIX_V6.md | ✅ 100% |
| V7 | FIX_V7.md | ✅ 100% |
| V8 | FIX_V8.md | ✅ 100% |
| V9 | FIX_V9.md + FIX_V9_PAGES.md | ✅ 100% |
| V10 | FIX_V10.md | ✅ 100% + **总进度总结** |
| S1 | FIX_20260727_1635.md | ✅ 100%（FIX 阻塞项） |
| V11 | FIX_V11.md | ✅ 100% |
| V12 | FIX_V12.md | ⬜ 待执行（托盘点击后窗口慢） |
| S2 | FIX_20260727_2343.md | ✅ 100%（b.txt：tts超时/db locked/端点持久化/agent-history链路/封面/进度同步） |
| S3 | FIX_20260728_LEGACY.md | 📄 文档化不修复（c.txt 批次遗留：mcp-chrome 60 + wordflow UI 255 tsc 错误清单、>800行拆分候选） |

依赖：`V4 → V5 → V7 → {V3,V6,V8} → V9 → V10 → V11`；V12 独立。

完整总结见 **FIX_V10.md**。

可选后续：其他 >800 行文件拆分、schema 版本化 migration — 见 FIX_V10 §1.4。
