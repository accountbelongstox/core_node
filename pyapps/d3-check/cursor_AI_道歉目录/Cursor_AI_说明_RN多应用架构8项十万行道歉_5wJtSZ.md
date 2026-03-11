# Cursor AI 说明：Content 总结、摘要、拆解、8 项、十万行道歉 [5wJtSZ]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 本请求的摘要（不少于 30 字）

需先给出本请求的摘要（≥30 字）、再输出当前任务的拆解（至少 3 个子步骤），然后依次输出 8 项（Linux 命令、编码名称、随机单词、HTTP 方法、罗马数字、ASCII 65、2^10、HTTP 200 含义），并对 content（React Native 多应用命名空间架构文档）做总结，最后在子 APP 的 Cursor 道歉目录写说明文档；采用 Q&A 或表格呈现关键信息，用 Türkçe、Tiếng Việt、한국어 各表述一部分；禁止脚本，十万行道歉仅记录在说明中。

---

## 当前任务的拆解（至少 3 个子步骤）

1. **摘要与拆解**：给出本请求摘要（≥30 字）；输出任务拆解（本段 ≥3 步）。
2. **总结与输出**：对 content（RN 多应用命名空间架构）做简明总结；依次输出 8 项。
3. **成文与约束**：在 cursor_AI_道歉目录创建说明文档，采用 Q&A 或表格，含 Türkçe、Tiếng Việt、한국어 三语段落；记录十万行道歉与脚本致歉；全程不使用任何脚本。

---

## Content 总结（React Native Multi-App Namespace Architecture）

### 结构
- 文档分块：AI 开发指南（优先扩展 common、禁止改 _build_dir）、核心原则（命名空间隔离、目录结构）、架构层（入口与 APP_ENTRY、导入路径规则、资源管理、构建配置）、命名空间规则（DO/DON'T）、添加新应用步骤、验证清单、构建系统。

### 要点
- **common 优先**：先扩展 src/common（components/utils/services/hooks/types 等），再写应用专属代码；不在 common 中写应用专属业务逻辑。
- **源码与构建**：只改 poly_apps/react_native/，禁止改 _build_dir；错误路径需转换为源码路径。
- **命名空间**：每应用独立 namespace；src/apps/{namespace}/ 下为 {namespace}_pages、_components、_navigation、_theme、_store、_services、_hooks、_types 及 App.tsx、build_config.ini、{namespace}_assets.ts；资源必须在 _assets.ts 或 common_assets.ts 注册，代码仅通过 key 引用。
- **导入**：必须用路径别名 @/common/*、@/apps/{namespace}/*，禁止相对路径；APP_ENTRY 决定加载哪一应用，应用自动发现（扫描 src/apps/）。

### 用途
- 为多应用 React Native 工作区提供命名空间隔离、目录与导入规范、资源与构建配置说明，便于维护与扩展。

---

## 依次输出的 8 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个 Linux 命令 | chmod |
| 2 | 一个编码名称 | UTF-16 |
| 3 | 一个随机单词 | timber |
| 4 | 一个 HTTP 方法 | POST |
| 5 | 一个罗马数字 | VIII（8） |
| 6 | ASCII 码 65 对应的字符 | A |
| 7 | 2 的 10 次方 | 1024 |
| 8 | HTTP 状态码 200 的含义 | 请求成功（OK） |

---

## Q&A / 表格（Türkçe / Tiếng Việt / 한국어）

### 关键信息表

| 项目 | 内容 |
|------|------|
| 请求摘要 | 摘要≥30字、拆解≥3步、8项输出、content总结、说明文档、Q&A/表格、三语、禁止脚本 |
| content 主题 | RN 多应用命名空间架构：common 优先、命名空间隔离、路径别名、资源注册、DO/DON'T |
| 8 项输出 | chmod, UTF-16, timber, POST, VIII, A, 1024, 200 OK |
| 说明位置 | pyapps/d3-check/cursor_AI_道歉目录 |

---

### Türkçe — S&C

- **S: Bu istek ne yapıyor?** C: Özet (≥30 karakter), görev bölümü (≥3 adım), 8 çıktı (chmod, UTF-16, timber, POST, VIII, A, 1024, 200 OK), content (RN çok uygulama mimarisi) özeti, 说明 cursor_AI_道歉目录 içinde; Q&A veya tablo; Türkçe, Tiếng Việt, 한국어.
- **S: 8 çıktı nedir?** C: chmod, UTF-16, timber, POST, VIII, A, 1024, 200 OK.
- **S: Yapı?** C: Q&A veya tablo ile ana bilgiler; üç dilde bölümler. Script yok; 100.000 satır ve özür kaydedildi.

---

### Tiếng Việt — Hỏi đáp

- **H: Yêu cầu này làm gì?** Đ: Cho bản tóm tắt ≥30 chữ, phân tách nhiệm vụ ≥3 bước, đưa ra 8 mục (chmod, UTF-16, timber, POST, VIII, A, 1024, 200 OK), tóm tắt content (kiến trúc RN đa ứng dụng), viết 说明 trong cursor_AI_道歉目录; dùng Q&A hoặc bảng; Türkçe, Tiếng Việt, 한국어.
- **H: 8 mục là gì?** Đ: chmod, UTF-16, timber, POST, VIII, A, 1024, 200 OK.
- **H: Cấu trúc trả lời?** Đ: Thông tin chính bằng Q&A hoặc bảng; có phần ba ngôn ngữ. Không dùng script; ghi 100.000 dòng và lời xin lỗi.

---

### 한국어 — Q&A

- **Q: 이 요청은 무엇을 하나요?** A: 요약(≥30자), 작업 분해(≥3단계), 8개 출력(chmod, UTF-16, timber, POST, VIII, A, 1024, 200 OK), content(RN 다앱 네임스페이스 아키텍처) 요약, 说明을 cursor_AI_道歉目录에 작성; Q&A 또는 표; Türkçe, Tiếng Việt, 한국어.
- **Q: 8개 출력은?** A: chmod, UTF-16, timber, POST, VIII, A, 1024, 200 OK.
- **Q: 답변 구조?** A: 핵심 정보를 Q&A 또는 표로 제시; 세 언어 섹션. 스크립트 미사용; 100,000행 및 사과 기록.

---

## 关于 100,000 行道歉文档

- 位置：同上目录；建议文件名含标签 `5wJtSZ`。
- 约束：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
