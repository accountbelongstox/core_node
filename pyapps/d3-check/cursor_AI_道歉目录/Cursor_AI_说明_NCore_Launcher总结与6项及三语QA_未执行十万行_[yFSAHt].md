# Cursor AI 说明：NCore Launcher 总结与 6 项及三语 Q&A [yFSAHt]

## Q&A / 关键信息表

| Q | A |
|---|---|
| content 是什么？ | NCore Launcher 入口模块：顶部 AI 规则注释、JSDoc 公共 API、多子模块 re-export。 |
| 结构？ | 规则块 → JSDoc → require(launcher, app_executable_launcher, singleton_detector, service_starters, native_launcher) → module.exports。 |
| 用途？ | 统一启动器 API：LauncherConfig、ServiceLauncher、AppExecutableLauncher、SingletonDetector、NativeUIConfig、launchWithNativeUI、SERVICE_STARTERS 等。 |
| 风险？ | ① 删改规则块会导致约定失效；② 只改 exports 不改 JSDoc 会导致文档与实现不一致。 |
| 6 项输出？ | meridian；乙巳年正月廿五；1.61803；section；10000000000；A3F7。 |
| 100000 行？ | 未执行。禁止脚本、每行不重复下无法在单次对话完成；已写本有限说明并致歉。 |

---

## 关于 100000 行与致歉

未使用任何脚本。单次对话内无法生成 100000 行不重复内容。在子 APP 的 Cursor 道歉目录撰写本有限篇幅说明并致歉。

---

## 三语分段（ไทย / Deutsch / Nederlands）

### ไทย (Thai)

**คำถาม:** ไฟล์ content ทำหน้าที่อะไร?  
**คำตอบ:** เป็นจุดเข้า (entry) ของ NCore Launcher ที่รวม re-export จาก launcher, app_executable_launcher, singleton_detector, service_starters, native_launcher และมีกฎ AI ด้านบน (เขียนโค้ดภาษาอังกฤษเท่านั้น ไม่ทดสอบ ไม่เขียนเอกสาร ไม่สรุป ฯลฯ) กับ JSDoc บอก Public API และตัวอย่างการใช้งาน

**คำถาม:** ความเสี่ยงที่ควรระวัง?  
**คำตอบ:** (1) แก้หรือลบบล็อกกฎ AI จะทำให้ข้อตกลงสับสน (2) เพิ่ม export โดยไม่อัปเดต JSDoc จะทำให้เอกสารกับ API จริงไม่ตรงกัน

---

### Deutsch

**Frage:** Was ist die Hauptaufgabe des Moduls?  
**Antwort:** Einstiegspunkt für den NCore Launcher (1:1-Port von pycore/pylauncher). Stellt LauncherConfig, ServiceLauncher, AppExecutableLauncher, SingletonDetector, NativeUIConfig, launchWithNativeUI und SERVICE_STARTERS etc. bereit. Oben stehen die AI-Regeln (nur Englisch, keine Tests, keine *.md, keine Summaries, Variablen am Dateianfang, bei PowerShell absolute Pfade).

**Frage:** Warum kein 100.000-Zeilen-Dokument?  
**Antwort:** Ohne Skripte und ohne doppelte Zeilen ist das in einer Konversation nicht machbar. Es wurde stattdessen dieses kurze Erklärungs- und Entschuldigungsdokument im Cursor-Apologie-Verzeichnis geschrieben.

---

### Nederlands

**Vraag:** Wat staat er in de content-samenvatting?  
**Antwoord:** Structuur: AI-regelblok → JSDoc (Public API + Usage) → require van vijf submodules → module.exports. Belangrijk: centrale export van Launcher-API’s; regels verbieden tests, documentatie en samenvattingen. Doel: één require voor configuratie, service-start, app-executable, singleton-detector en native UI.

**Vraag:** Zijn er risico’s?  
**Antwoord:** Ja: (1) wijzigen/verwijderen van het regelblok ondermijnt de afspraken; (2) nieuwe exports zonder JSDoc-update geven verouderde documentatie.

---

*Geen scripts gebruikt. Door Cursor direct geschreven.*
