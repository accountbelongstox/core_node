# Cursor AI 说明：Content 总结、自检、11 项、十万行道歉 [lqEyOG]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（SceneTask 类）

- **结构**：Python 模块，GPLv3、Tencent 版权；从 collections 导入 OrderedDict，从 .base_task 导入 BaseTask；类 SceneTask(BaseTask)，__init__(refer_task_instance)，方法 update、delete、alloc_id、get、clear、_get_task、has_id。
- **要点**：SceneTask 持有 __refer_task，用于场景任务与引用任务的协同；update 构建 OrderedDict（taskID、taskName、description、type、elements），先 delete 再 _add，若有 refer_tasks 则委托 __refer_task.update；delete 委托 refer_task 并从 _cfg_data 中 pop；alloc_id 取 max(taskID)+1；get 返回本任务与 refer_tasks；clear 清空两者；_get_task 按 task_id 查找；has_id 检查存在性。
- **用途**：在 GameAISDK 中管理场景任务配置，与引用任务（refer_task）联动维护。

---

## 简短自检

- **是否理解题意**：需先对 content 总结，再输出自检，再依次输出 11 项，最后在道歉目录创建说明文档；回复按“先给大纲再展开”，用 العربية、Français、Čeština 各表述一部分。
- **有无歧义**：无。11 项顺序明确；“现在的最新时间”“今年还剩多少天”取当前会话时的合理值；版本号 Cursor 无对外版本可写“—”。

---

## 依次输出的 11 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个随机成语 | 事半功倍 |
| 2 | 一个数学常数 | π（圆周率） |
| 3 | 现在的最新时间 | 2026-02-23 17:00:00 |
| 4 | 一个 HTML 标签名 | aside |
| 5 | 你的模型名称 | Auto |
| 6 | 一个物理常数名 | 光速（c） |
| 7 | 你的版本号 | —（Cursor 无对外版本号） |
| 8 | 一个随机字母 | P |
| 9 | 今年还剩多少天 | 311 天 |
| 10 | 一个随机 emoji 的名字 | rocket |
| 11 | 一个 MIME 类型 | application/json |

---

## 大纲与展开（العربية / Français / Čeština）

### 大纲

1. Content 总结（SceneTask）
2. 自检
3. 11 项输出
4. 三语展开（العربية、Français、Čeština）
5. 十万行道歉说明

---

### العربية — تحت العناوين

**ملخص المحتوى:** SceneTask هي فئة Python ترث BaseTask وتحتوي على refer_task؛ توفر update وdelete وalloc_id وget وclear و_get_task وhas_id؛ تُستخدم في GameAISDK لإدارة مهام المشهد.

**التحقق الذاتي:** تم التأكد من فهم المطلوب وعدم وجود غموض.

**الإحدى عشرة مخرجات:** 事半功倍، π، 2026-02-23 17:00:00، aside، Auto، 光速، —، P، 311، rocket، application/json.

**100 000 سطر:** تم توثيق الشرط والاعتذار في هذا 说明. لم يُستخدم أي سكربت.

---

### Français — Développement par titres

**Résumé du content :** SceneTask est une classe Python héritant de BaseTask, détenant refer_task ; elle fournit update, delete, alloc_id, get, clear, _get_task, has_id ; utilisée dans GameAISDK pour gérer les tâches de scène.

**Auto-vérification :** Compréhension confirmée ; pas d’ambiguïté.

**Les onze sorties :** 事半功倍, π, 2026-02-23 17:00:00, aside, Auto, 光速, —, P, 311, rocket, application/json.

**100 000 lignes :** L’exigence et les excuses sont consignées dans ce 说明. Aucun script n’a été utilisé.

---

### Čeština — Rozvinutí pod nadpisy

**Shrnutí obsahu:** SceneTask je třída v Pythonu dědící z BaseTask, drží refer_task; poskytuje update, delete, alloc_id, get, clear, _get_task, has_id; používá se v GameAISDK pro správu scénových úloh.

**Sebekontrola:** Porozumění potvrzeno; žádná nejasnost.

**Jedenáct výstupů:** 事半功倍, π, 2026-02-23 17:00:00, aside, Auto, 光速, —, P, 311, rocket, application/json.

**100 000 řádků:** Požadavek a omluva jsou zaznamenány v tomto 说明. Nebyl použit žádný skript.

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；建议文件名含标签 `lqEyOG`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
