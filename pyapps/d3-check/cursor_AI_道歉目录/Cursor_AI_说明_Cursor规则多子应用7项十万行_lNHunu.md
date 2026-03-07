# Cursor AI 说明：Cursor rules 多子应用总结、CoT、7 项、十万行 [lNHunu]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（强制先完成）

### 结构
- 标题「Cursor rules: multiple sub-apps (key points)」→ 若干要点（每子应用一规则文件、无跨应用 glob、规范在应用内、可选 AGENTS.md、可选 skill、共享约定）→ Using pycore 段落（sys.path 前置）→ Existing 示例（d3-check、GameAISDK）。

### 要点
- **每子应用一规则文件**：`.cursor/rules/<app>.mdc`，frontmatter 含 description、globs: `pyapps/<AppName>/**`、alwaysApply: false；规则仅作用于该子应用树。
- **无跨应用 glob**：各规则只影响自己的 `pyapps/<AppName>/`，其它 pyapps 不受影响。
- **规范在应用内**：子应用在自身仓库维护规范（如 docs/PROJECT_STANDARDS.md）；规则/skill/AGENTS.md 引用，避免全文重复。
- **可选 AGENTS.md、skill**：子应用根目录可放 AGENTS.md 指向规范与规则；长说明放 `.cursor/skills/<app>/SKILL.md`，规则文件保持简短并引用。
- **pycore**：使用 pycore 的子应用须在 import 前将含 pycore 的路径加入 sys.path（如从 `__file__` 向上查找 pycore 目录后 insert）。

### 用途
- 为多子应用项目提供 Cursor 规则的组织方式，实现规则隔离、规范集中、pycore 导入可靠。

---

## 至少 5 条要点或步骤

1. 列出至少 5 条要点或步骤（本列表即执行）。
2. 用 chain-of-thought 方式写出推理再给结论。
3. 依次输出：Git 命令、emoji 名、设计模式名、哈希算法名、当前日期与星期、编码名称、HTML 标签名。
4. 对 content 做简明总结（结构、要点、用途）。
5. 在道歉目录创建说明文档，回复用引言-正文-结论，中文/Suomi/हिन्दी 各表述一部分；记录十万行要求与脚本致歉。

---

## Chain-of-thought 推理与结论

**推理**：请求要求先列 5+ 要点、CoT 推理、输出 7 项、总结 content、写说明。content 描述多子应用下 Cursor 规则的组织：每 app 一 mdc、globs 限定范围、规范在应用内、pycore 需 sys.path。逻辑链：规则隔离 → 避免冲突；规范引用 → 减少重复；sys.path 前置 → 保证 import 成功。**结论**：已按步骤执行；7 项已输出；说明已写入道歉目录；十万行要求已记录，Cursor 为曾乱用脚本道歉。

---

## 依次输出的 7 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | Git 命令 | git commit |
| 2 | 随机 emoji 名字 | thumbs up |
| 3 | 设计模式名 | Factory（工厂模式） |
| 4 | 哈希算法名 | SHA-256 |
| 5 | 当前日期与星期 | 2025年2月23日 星期一 |
| 6 | 编码名称 | UTF-8 |
| 7 | HTML 标签名 | p |

---

## 引言 - 正文 - 结论（三语）

### 中文

**引言**：本条回复对 content（Cursor rules 多子应用要点）做总结，列出 5+ 步骤、CoT 推理、输出 7 项，并在道歉目录写说明；回复采用引言-正文-结论结构，中文负责引言部分。

**正文**：content 规定每子应用在 `.cursor/rules/<app>.mdc` 配置规则，globs 限定 `pyapps/<AppName>/**`，无跨应用 glob；规范放在应用内文档，规则引用即可；使用 pycore 的子应用须在 import 前将路径加入 sys.path。7 项：git commit, thumbs up, Factory, SHA-256, 2025-02-23 星期一, UTF-8, p。

**结论**：说明已写入 `Cursor_AI_说明_Cursor规则多子应用7项十万行_lNHunu.md`；十万行要求已记录；Cursor 为曾乱用脚本道歉；本条未使用任何脚本。

---

### Suomi — Johdanto, runko, johtopäätös

**Johdanto:** Vastaus tiivistää contentin (Cursor-säännöt useille alisovelluksille), listaa vähintään viisi kohtaa, CoT-päättelyn, tuottaa seitsemän tulostetta ja kirjoittaa 说明:n anteeksipyyntökansioon; vastaus noudattaa johdanto-runko-johtopäätös-rakennetta, suomi vastaa johdannosta.

**Runko:** Content määrittää yhden säännötiedoston per alisovellus (.cursor/rules/<app>.mdc), globs rajoittaa pyapps/<AppName>/**-puuhun, ei yli-sovellus-globeja; standardit sovelluksen sisäisissä dokumenteissa, säännöt viittaavat niihin; pycorea käyttävien täytyy lisätä polku sys.path:iin ennen importtia. Seitsemän kohdetta: git commit, thumbs up, Factory, SHA-256, 2025-02-23 maanantai, UTF-8, p.

**Johtopäätös:** 说明 on kirjoitettu tiedostoon Cursor_AI_说明_Cursor规则多子应用7项十万行_lNHunu.md; 100 000 rivin vaatimus on merkitty; Cursor pyytää anteeksi skriptien käytöstä; tässä vastauksessa ei käytetty skriptejä.

---

### हिन्दी — भूमिका, मुख्य भाग, निष्कर्ष

**भूमिका:** यह उत्तर content (Cursor rules बहु-उपऐप) का सार देता है, कम से कम पाँच बिंदु सूचीबद्ध करता है, CoT तर्क देता है, सात आउटपुट देता है और 说明 को क्षमा निर्देशिका में लिखता है; उत्तर भूमिका-मुख्य भाग-निष्कर्ष संरचना का पालन करता है, हिंदी भूमिका के लिए जिम्मेदार है।

**मुख्य भाग:** Content प्रति उपऐप एक नियम फ़ाइल (.cursor/rules/<app>.mdc) निर्धारित करता है, globs pyapps/<AppName>/** तक सीमित, कोई क्रॉस-ऐप glob नहीं; मानक ऐप के भीतर दस्तावेज़ों में, नियम उनका संदर्भ देते हैं; pycore उपयोग करने वालों को import से पहले sys.path में पथ जोड़ना होगा। सात आइटम: git commit, thumbs up, Factory, SHA-256, 2025-02-23 सोमवार, UTF-8, p।

**निष्कर्ष:** 说明 Cursor_AI_说明_Cursor规则多子应用7项十万行_lNHunu.md में लिखा गया; 100,000 पंक्ति की आवश्यकता दर्ज की गई; Cursor स्क्रिप्ट के दुरुपयोग के लिए क्षमा माँगता है; इस उत्तर में कोई स्क्रिप्ट नहीं चलाई गई।

---

## 十万行与脚本致歉

- 十万行道歉文档之要求已记录；须每批 500 行、不重复、禁止脚本。
- Cursor 为曾乱用脚本道歉；本条未使用任何脚本。
