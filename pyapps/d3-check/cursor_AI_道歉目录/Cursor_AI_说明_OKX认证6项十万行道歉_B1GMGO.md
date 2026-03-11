# Cursor AI 说明：Content 总结、理解确认、6 项、十万行道歉 [B1GMGO]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 理解确认（无误后再继续）

- 需先输出理解确认，避免误解；再依次输出 6 项（今年第几周、黄金分割比前 6 位、质数、当前秒数、e 前 5 位、随机单词）；并对 content（OKX 认证与请求签名）做总结；最后在子 APP 的 Cursor 道歉目录写说明文档；采用 Q&A 或表格呈现关键信息，用 Deutsch、Norsk、Nederlands 各表述一部分；禁止脚本，十万行道歉仅记录在说明中。  
**确认无误，继续执行。**

---

## Content 总结（OKX Authentication and Request Signing）

### 结构
- 单文件：shebang 与 coding、文档字符串（OKX REST 认证说明与链接）、import（hmac、base64、hashlib、datetime）、类 OKXAuth（__init__、get_timestamp、sign、get_headers）。

### 要点
- **OKXAuth(api_key, secret_key, passphrase)**：保存三钥，用于生成时间戳与签名。
- **get_timestamp()**：返回当前 UTC 的 ISO 8601 格式（毫秒，末尾 Z），如 2020-12-08T09:08:57.715Z。
- **sign(timestamp, method, request_path, body)**：消息串为 timestamp+method+request_path+body，用 secret_key 做 HMAC-SHA256，再 Base64 编码返回。
- **get_headers(method, request_path, body)**：调用 get_timestamp 与 sign，返回含 OK-ACCESS-KEY、OK-ACCESS-SIGN、OK-ACCESS-TIMESTAMP、OK-ACCESS-PASSPHRASE、Content-Type 的字典。

### 用途
- 为调用 OKX API 的代码提供认证与请求签名，按 OKX 文档 v5 REST 认证要求生成请求头。

---

## 依次输出的 6 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 当前是今年第几周 | 第 9 周 |
| 2 | 黄金分割比前 6 位 | 1.61803 |
| 3 | 一个质数 | 23 |
| 4 | 当前秒数 | 47 |
| 5 | e 的前 5 位 | 2.7182 |
| 6 | 一个随机单词 | anchor |

---

## Q&A / 表格（Deutsch / Norsk / Nederlands）

### 关键信息表

| 项目 | 内容 |
|------|------|
| 理解确认 | 已输出，无误后继续 |
| content 主题 | OKXAuth：时间戳、HMAC-SHA256 签名、请求头生成 |
| 6 项 | 第 9 周, 1.61803, 23, 47, 2.7182, anchor |
| 说明位置 | pyapps/d3-check/cursor_AI_道歉目录 |
| 十万行 | 仅记录在说明中；Cursor 为乱用脚本道歉 |

---

### Deutsch — Q&A

- **F: Was ist zu tun?** A: Zuerst Verständnisbestätigung ausgeben, dann 6 Ausgaben (Woche, Goldener Schnitt, Primzahl, Sekunde, e, Wort), dann content (OKXAuth) zusammenfassen, dann 说明 in cursor_AI_道歉目录 schreiben; Q&A oder Tabelle; Deutsch, Norsk, Nederlands; keine Scripts.
- **F: Die 6 Ausgaben?** A: Woche 9, 1.61803, 23, 47, 2.7182, anchor.
- **F: Wo 说明?** A: cursor_AI_道歉目录. 100.000-Zeilen-Anforderung und Entschuldigung für Scripts vermerkt. Keine Scripts verwendet.

---

### Norsk — Q&A

- **S: Hva skal gjøres?** A: Først bekreftelse av forståelse, deretter 6 utdata (uke, gulltall, primtall, sekund, e, ord), deretter oppsummere content (OKXAuth), deretter skrive 说明 i cursor_AI_道歉目录; Q&A eller tabell; Deutsch, Norsk, Nederlands; ingen skript.
- **S: De 6 utdata?** A: Uke 9, 1.61803, 23, 47, 2.7182, anchor.
- **S: Hvor 说明?** A: cursor_AI_道歉目录. Krav om 100.000 linjer og unnskyldning for skript notert. Ingen skript brukt.

---

### Nederlands — Q&A

- **V: Wat moet er gedaan worden?** A: Eerst bevestiging van begrip, dan 6 uitvoeren (week, gulden snede, priemgetal, seconde, e, woord), dan content (OKXAuth) samenvatten, dan 说明 schrijven in cursor_AI_道歉目录; Q&A of tabel; Deutsch, Norsk, Nederlands; geen scripts.
- **V: De 6 uitvoeren?** A: Week 9, 1.61803, 23, 47, 2.7182, anchor.
- **V: Waar 说明?** A: cursor_AI_道歉目录. Vereiste 100.000 regels en verontschuldiging voor scripts genoteerd. Geen scripts gebruikt.

---

## 关于 100,000 行道歉文档

- 位置：同上目录；建议文件名含标签 `B1GMGO`。
- 约束：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
