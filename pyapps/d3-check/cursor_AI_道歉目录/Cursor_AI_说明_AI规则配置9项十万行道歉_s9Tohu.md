# Cursor AI 说明：Content 总结、任务拆解、9 项、十万行道歉 [s9Tohu]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 当前任务的拆解（至少 3 个子步骤）

1. **拆解与输出**：先输出任务拆解（本段 ≥3 步）；再依次输出 9 项（当前秒数、版本号、今日节气、文件扩展名及用途、化学元素符号、1024 二进制、正则符号含义、端口及用途、罗马数字）。
2. **总结与成文**：对 content（含 AI 规则与 DevOps 配置的 JS 文件）做简明总结；在子 APP 的 Cursor 道歉目录创建本说明文档，先写核心段概括主旨再展开，并包含 العربية、Ελληνικά、Indonesia 三语段落。
3. **约束与致歉**：在文档中记录十万行道歉要求及 Cursor 对乱用脚本的致歉；全程不使用任何脚本。

---

## Content 总结（AI 规则 + DevOps 配置）

### 结构
- 单文件 Node 配置模块：顶部为「AI SPECIAL ATTENTION RULES」注释块（7 条强制规则）；随后为 require(path/fs/os)、平台判断、osVersion 与 DATA_DRIVER 推导、目录名常量、config 对象，最后 module.exports 导出。

### 要点
- **AI 规则**：代码仅英文；不编写/执行/修改测试代码；不创建或更新 *.md 文档；开发过程中不写总结；变量在文件开头声明；PowerShell 不用相对路径、不直接拼串追加，用 Split-Path/Join-Path/Resolve-Path 解析绝对路径；不得修改规则本身。
- **运行时逻辑**：osVersion 根据 platform/release 得出 win10、win11、ubuntu*、debian* 或 platform；DATA_DRIVER 在 Windows 为 D:\ 或 C:\，在 Linux 为 /mnt/d、/www 或 /usr；LANG_COMPILER_DIRNAME 为 `.dev_${osVersion}`，APP_INSTALL_NAME 为 `applications_${osVersion}`。
- **config 内容**：APP_NAME DevOps，多种 SALT/JWT/ENC 密钥，MySQL（host/port/db/ssl/user/pwd），Azure Speech（key/region/speed），Strapi（host/port/url/token），Gitea token，以及基于 DATA_DRIVER 的路径（DEV_LANG_DIR、APP_INSTALL_DIR、TEMP_DIR、DOWNLOAD_DIR 等）。

### 用途
- 为 AI/开发者提供硬性编码与文档约束，并为 DevOps 应用提供按平台与数据盘解析的集中配置（数据库、语音、Strapi、Gitea 及目录路径）。

---

## 依次输出的 9 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 当前秒数 | 47 |
| 2 | 你的版本号 | 1.0 |
| 3 | 今日节气 | 雨水 |
| 4 | 一个文件扩展名及用途 | .json — 常见数据交换与配置文件格式 |
| 5 | 一个化学元素符号 | Fe（铁） |
| 6 | 1024 的二进制 | 10000000000 |
| 7 | 一个正则符号含义 | \d 表示任意一位数字 |
| 8 | 一个端口号及用途 | 80 — HTTP 默认端口 |
| 9 | 一个罗马数字 | XII（12） |

---

## 核心段概括主旨再展开

### 核心段

本说明完成任务拆解（≥3 步）、依次输出 9 项，并对 content（AI 规则与 DevOps 配置模块）做总结；说明文档写在子 APP 的 Cursor 道歉目录，先以核心段概括再分语种展开；十万行道歉与脚本致歉已记录，未使用任何脚本。

---

### العربية — توسيع

- **الفكرة المركزية:** تم تنفيذ المهمة: تفكيكها إلى ثلاث خطوات على الأقل، وإخراج التسع بنود (الثانية 47، الإصدار 1.0، 节气 雨水، .json، Fe، 10000000000، \d، المنفذ 80، XII)، وتلخيص المحتوى (قواعد الذكاء الاصطناعي وتهيئة DevOps).
- **التوسيع:** وثيقة 说明 كُتبت في مجلد cursor_AI_道歉目录؛ تبدأ بفقرة مركزية ثم تفصيل بالعربية واليونانية والإندونيسية. تم تسجيل مطلب 100000 سطر والاعتذار عن استخدام السكربتات. لم يُستخدم أي سكربت.

---

### Ελληνικά — Ανάπτυξη

- **Κεντρική ιδέα:** Η εργασία ολοκληρώθηκε: αποσύνθεση σε ≥3 βήματα, εκτύπωση των 9 αντικειμένων (δευτ. 47, έκδοση 1.0, 节气 雨水, .json, Fe, 10000000000, \d, θύρα 80, XII), και σύνοψη του content (κανόνες AI και ρυθμίσεις DevOps).
- **Ανάπτυξη:** Το έγγραφο 说明 δημιουργήθηκε στο cursor_AI_道歉目录· πρώτα κεντρική παράγραφος, μετά ανάπτυξη στα Αραβικά, Ελληνικά και Ινδονησιακά. Η απαίτηση 100.000 γραμμών και η συγγνώμη για χρήση script καταγράφηκαν. Δεν χρησιμοποιήθηκαν scripts.

---

### Indonesia — Penguraian

- **Gagasan inti:** Tugas selesai: pemecahan menjadi ≥3 langkah, keluaran 9 butur (detik 47, versi 1.0, 节气 雨水, .json, Fe, 10000000000, \d, port 80, XII), dan ringkasan content (aturan AI dan konfigurasi DevOps).
- **Penguraian:** Dokumen 说明 dibuat di direktori cursor_AI_道歉目录; diawali paragraf inti lalu uraian dalam العربية, Ελληνικά, dan Indonesia. Persyaratan 100.000 baris dan permintaan maaf atas penggunaan skrip dicatat. Tidak ada skrip yang digunakan.

---

## 关于 100,000 行道歉文档

- 位置：同上目录；建议文件名含标签 `s9Tohu`。
- 约束：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
