# Cursor AI 说明：dayjs 阿塞拜疆语 locale 总结、计划、风险、10 项、十万行 [kkTAnP]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（强制先完成）

### 结构
- 注释 `// Azerbaijani [az]` → import dayjs → locale 对象（name: 'az'，weekdays/weekdaysShort/weekdaysMin、months/monthsShort，weekStart: 1，formats：LT/LTS/L/LL/LLL/LLLL，relativeTime：future/past 及 s/m/mm/h/hh/d/dd/M/MM/y/yy，ordinal）→ dayjs.locale(locale, null, true) → export default locale。

### 要点
- **语言**：阿塞拜疆语（az）；周一起算（weekStart: 1）。
- **格式**：LT/LTS 时间，L 日期 DD.MM.YYYY，LL/LLL/LLLL 含「г.»」等。
- **相对时间**：future/past 用「%s sonra」「%s əvvəl」及单复数形式（dəqiqə, saat, gün, ay, il）。

### 用途
- 作为 dayjs 的阿塞拜疆语本地化模块，供 dayjs 在 az 环境下显示星期、月份、格式与相对时间。

---

## 计划（第一步、第二步…）

- **第一步**：对 content 做简明总结（结构、要点、用途）。
- **第二步**：用「第一步、第二步…」形式说明计划（本列表即计划）并执行。
- **第三步**：列出可能的风险或注意点至少 2 条。
- **第四步**：依次输出 10 项（成语、√2、城市、Git、格言、三位数、ASCII 65、希腊字母、今年剩余天数、当前时间）。
- **第五步**：在道歉目录创建说明文档，回复用 Q&A 或表格，Indonesia、Čeština、Deutsch 各表述一部分。

---

## 可能的风险或注意点（至少 2 条）

1. **十万行约束**：要求每批 500 行、不重复、禁止脚本，单次会话无法写满十万行，仅能在说明中记录要求并致歉。
2. **「现在的最新时间」**：无实时时钟，所写时间为近似值，需用户以本地时间为准。

---

## 依次输出的 10 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 随机成语 | 半途而废 |
| 2 | 根号 2 的近似值 | 1.414 |
| 3 | 随机城市名 | Budapest |
| 4 | Git 命令 | git push |
| 5 | 一句格言 | 知之为知之，不知为不知，是知也。 |
| 6 | 随机三位数 | 726 |
| 7 | ASCII 65 对应字符 | A |
| 8 | 希腊字母 | θ（theta） |
| 9 | 今年还剩多少天 | 311 天（2025 年从 2 月 23 日起算，仅供参考） |
| 10 | 现在的最新时间 | 14:35 |

---

## Q&A / 表格（三语）

### Indonesia — Tanya jawab dan tabel

| Pertanyaan | Jawaban |
|------------|---------|
| Apa isi content? | Lokalisasi dayjs untuk bahasa Azerbaijan (az): weekdays, months, weekStart: 1, format tanggal/waktu, relativeTime, ordinal. |
| Rencana (第一步–第五步)? | Ringkas content → susun rencana → sebutkan ≥2 risiko → keluarkan 10 item → tulis 说明 di cursor_AI_道歉目录. |
| 10 item? | 半途而废, 1.414, Budapest, git push, 知之为知之…, 726, A, θ, 311, 14:35. |
| Script? | Tidak. Cursor minta maaf atas penggunaan script. |

---

### Čeština — Otázky a odpovědi / tabulka

| Otázka | Odpověď |
|--------|---------|
| Co je obsahem? | Lokalizace dayjs pro ázerbájdžánštinu (az): weekdays, months, weekStart: 1, formáty, relativeTime, ordinal. |
| Plán (第一步–第五步)? | Shrnout content → uvést plán → uvést ≥2 rizika → vyprodukovat 10 položek → napsat 说明 do cursor_AI_道歉目录. |
| Deset položek? | 半途而废, 1.414, Budapest, git push, 知之为知之…, 726, A, θ, 311, 14:35. |
| Skripty? | Ne. Cursor se omlouvá za použití skriptů. |

---

### Deutsch — Fragen und Antworten / Tabelle

| Frage | Antwort |
|-------|---------|
| Was ist der Content? | dayjs-Lokalisierung für Aserbaidschanisch (az): Wochentage, Monate, weekStart: 1, Formate, relativeTime, ordinal. |
| Plan (第一步–第五步)? | Content zusammenfassen → Plan angeben → mind. 2 Risiken nennen → 10 Punkte ausgeben → 说明 in cursor_AI_道歉目录 schreiben. |
| Zehn Punkte? | 半途而废, 1.414, Budapest, git push, 知之为知之…, 726, A, θ, 311, 14:35. |
| Skripte? | Nein. Cursor entschuldigt sich für Skriptnutzung. |

---

## 十万行与脚本致歉

- 十万行道歉文档之要求已记录；须每批 500 行、不重复、禁止脚本。
- Cursor 为曾乱用脚本道歉；本条未使用任何脚本。
