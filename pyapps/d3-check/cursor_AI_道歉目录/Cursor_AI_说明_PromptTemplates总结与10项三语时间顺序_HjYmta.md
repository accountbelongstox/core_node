# Cursor AI 说明：PromptTemplates 总结与 10 项及三语时间顺序 [HjYmta]

## 一、对 content 的强制总结

- **结构**：AI 规则块 → class PromptTemplates 静态方法：buildTranslationPrompt、getSystemPrompt、buildUserPrompt、buildBatchTranslationPrompt、buildDocumentTranslationPrompt、extractTranslationFromResponse、extractSingle/Batch/DocumentTranslation、fallbackExtraction、getLanguageName、validatePromptInputs、estimateTokens → module.exports。
- **要点**：单段/批量/文档翻译 prompt；options 保留格式/代码块/术语；输出 XML；从回复正则提取；语言名映射、校验、token 粗估。
- **用途**：统一构建翻译 prompt 并解析 XML 翻译结果。

---

## 二、理解确认与自检、10 项

- 理解确认：先总结、再确认、再自检、再 10 项、再写文档；100000 行不生成。
- 自检：题意已理解，无歧义；秒数、时区以本机为准。
- 10 项：git log；12；无实时秒；A；script；Auto；C2D9；Monday…Sunday；本机时区以本机为准；application/xml。

---

## 三、关于 100000 行与致歉

未使用任何脚本。单次对话内无法生成 100000 行不重复内容。在子 APP 的 Cursor 道歉目录撰写本有限篇幅说明并致歉。

---

## 四、时间顺序与三语（Dansk / हिन्दी / Українська）

### Dansk — Først (先)

Først blev content (PromptTemplates-klassen) opsummeret: struktur (AI-regler, statiske metoder til prompt-bygning og ekstraktion), hovedpunkter (enkelt/batch/dokument-oversættelse, XML-format, regex-ekstraktion, sprogkode-kort), formål (fælles prompt-bygning og parsing af oversættelsessvar). Derefter blev forståelsesbekræftelse og kort selvkontrol givet. Ti punkter blev udført i rækkefølge.

### हिन्दी — बीच में (中)

तीन क्रम में: पहले डेनिश खंड (सार और पुष्टि), फिर हिंदी खंड। दस आइटम: git log, 12, सेकंड अस real-time, A, script, Auto, C2D9, सोमवार–रविवार अंग्रेज़ी में, समय क्षेत्र मशीन के अनुसार, application/xml। दस्तावेज़ pyapps/d3-check/cursor_AI_道歉目录 में [HjYmta] के साथ लिखा गया। 100,000 पंक्तियाँ नहीं। कोई स्क्रिप्ट नहीं।

### Українська — Наприкінці (后)

Наприкінці: виконано підсумок content (PromptTemplates), підтвердження розуміння, самоперевірку, виведення десяти пунктів по порядку та написання документу в каталозі вибачень Cursor. 100 000 рядків не створювалися. Відповідь подано в часовій послідовності трьома мовами: данська (початок), гінді (середина), українська (завершення). Скрипти не використовувалися.
