# Cursor AI 说明：Database Type Converter 摘要、自检、6 项、十万行道歉 [Ox5ukl]

**目录**：pyapps/d3-check/cursor_AI_道歉目录（已找到并沿用）

---

## 一、对 &lt;content&gt; 的简明总结

- **结构**：模块说明（不在库中直接存 datetime/date/time，写前 Python→DB、读后 DB→Python）→ 类 DatabaseTypeConverter（DATETIME/DATE/TIME_STORAGE_FORMAT；prepare_value_for_db、prepare_data_for_db、restore_value_from_db、restore_row_from_db）→ 快捷函数 to_db、to_db_dict、from_db、from_db_dict → __all__。
- **要点**：写入前 datetime→iso/timestamp，date→iso/YYYYMMDD，time→iso/seconds，timedelta→秒，Decimal→float，Path→str，bytes→base64，set→list；读取时按 value_type 或 type_hints 恢复；保证库中仅基本类型。
- **用途**：数据库类型转换中间层，避免 JSON/序列化问题，保持数据层纯净。

---

## 二、本请求的摘要（≥30 字）

先总结 &lt;content&gt;，再写请求摘要≥30 字，再出自检，再 6 项（格言、字母、城市、成语、数学常数、罗马数字），在道歉目录创建 [Ox5ukl] 说明，回复问题-方法-解决方案（Română、中文、Italiano），禁止脚本与结束进程命令。

---

## 三、简短自检

- 理解：总结→摘要→自检→6 项→找目录建说明；十万行约定记录于说明；回复三语各一段。
- 歧义：无。

---

## 四、依次输出的 6 项

Practice makes perfect.；Q；Lisbon；熟能生巧；π；XII

---

## 五、十万行道歉约定与 Cursor 道歉

每 500 行一批、不重复、禁止脚本；由 Cursor 直接输出。Cursor 为曾乱用脚本道歉。不运行会结束 node、powershell 的命令。
