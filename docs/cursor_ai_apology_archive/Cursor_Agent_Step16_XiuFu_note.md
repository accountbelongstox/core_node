# Cursor Agent Step16 XiuFu note ( XiuFuWenDang ) 

** CunFang position Zhi **: `pyapps/d3-check/cursor_AI_ apology directory ` 
** ZhuTi **: Step16 KuoZhan Applications, Cursor Agent AnZhuangFangShi and KeZhi line WenJianMing XiuZheng and YiJu . 

---

## 1. WenTi and JieLun 

### 1.1 ApplicationsList.xml / ApplicationsList.json is Fou by Diao use 

- ** JieLun : AnZhuangLiuCheng not used this Liang WenJian . **
- Step16 Jin in No. 71 line dot `ApplicationsList.ps1`, use BaoLieBiaoLaiZiGaiJiao this within `$Global:APPLICATIONS_PACKAGES`, `$Global:BasePackages`, `$Global:COMMON_SOFTWARE_PACKAGES` etc. HaXiBiao . 
- CangKu within Jin to Xia position ZhiYin use `ApplicationsList.xml`, purpose Jun for **git/ BeiFen LuJingLieBiao **, not Can and AnZhuangLuoJi : 
- `scripts/git/gitput_unified.ps1`
- `scripts/git/gitput_unified.sh`
- `scripts/git/gitput_unified_modules/config.py`
- because CiCiQian to XML/JSON XiuGaiShu at WuGai ( LuanXie ) , Yi ** HuiFu ** for XiuGaiQianZhuangTai (`InstallType=web`, `PackageId=https://cursor.com/install`) , not ZaiJiangQiShi for AnZhuang config Yuan . 

### 1.2 KeZhi line WenJianMing : cursor-agent.exe Hai is agent.exe

- ** JieLun : to GuanFangWenDang for Zhun , AnZhuangHouYun line MingLing for `agent`, to YingKeZhi line WenJian for `agent.exe`. **
- YiJu : 
- https://cursor.com/install: AnZhuangMingLing for `irm 'https://cursor.com/install?win32=true' | iex` (Windows PowerShell) . 
- https://cursor.com/docs/cli/overview: AnZhuangHou "Run interactive session" Xie is **`agent`**, WeiChuXian `cursor-agent.exe`. 
- because CiJiang config in ZhuKeZhi line WenJianMing by `cursor-agent.exe` Gai for **`agent.exe`**, and GuanFangWenDangYiZhi . 

---

## 2. ShiJiXiuGai ( JinDong Step16 ZhenShi use Yuan ) 

** unique by Step16 AnZhuangLiuChengDuQu config Yuan **: `scripts/shells/win/win_common/ApplicationsList.ps1`. 

in GaiWenJian in CursorAgent item MuYiZuo such as XiaXiuZheng : 

1. **Exec**: by `cursor-agent.exe` Gai for **`agent.exe`** ( and GuanFang "run `agent`" YiZhi ) . 
2. **AdditionalKeywords**: Gai for `@("agent", "cursor", "cursor-agent")`, to GuanFangZhuMingLing `agent` YouXian use at JianCe . 
3. ** ZhuShi **: ZhuMing Step16 AnZhuang config JinLaiZi this .ps1, **ApplicationsList.xml / ApplicationsList.json not by AnZhuangLiuChengDuQu **, BiMianHouXuZai to XML/JSON Zuo no XiaoXiuGai . 

Qi it LuoJiBaoChi not Bian : `InstallType = "powershell"`, `PowerShellCommand = "irm 'https://cursor.com/install?win32=true' | iex"`, and GuanFangAnZhuangFangShiYiZhi . 

---

## 3. XiuFuWenDang summary 

| item | note |
|----|------|
| XML/JSON is FouCan and AnZhuang | Fou ; YiHuiFuYuanZhuang , not ZaiDangAnZhuangYuan use . |
| ZhenShiAnZhuang config Yuan | Jin `ApplicationsList.ps1` (Step16 No. 71 line dot GaiJiao this ) . |
| GuanFangAnZhuangHouMingLing | `agent` ( Jian cursor.com/docs/cli/overview) . |
| ZhuKeZhi line WenJianMing | `agent.exe` ( YiXieRu ApplicationsList.ps1) . |

to Shang within Rong for this CiXiuFu WanZheng note , GongHouXuChaYue and WeiHu use . 

---

## 4. for HeMi etc. XiuFuYun line Hou agent RengBao MODULE_NOT_FOUND (Access denied) 

### 4.1 XianXiang 

- RiZhi in KeJian : `[CURSORAGENT] Agent runtime missing or corrupt (no index.js under cursor-agent\versions); will re-run install.` to and `Installing Cursor agent CLI...`, note ** Mi etc. XiuFuLuoJiYiZhi line **. 
- SuiHouBaoCuo : `Agent CLI install failed: Access to the path 'merkle-tree-napi.win32-x64-msvc.node' is denied.`
- ZaiYun line agent when ChuXian : `Error: Cannot find module '...\cursor-agent\versions\2026.02.13-41ac335\index.js'` (MODULE_NOT_FOUND) . 

### 4.2 Yuan because 

- ** Mi etc. XiuFu have Zhi line **: JianCe to runtime QueShiHouHuiDiao use GuanFangAnZhuangJiao this (`irm ... | iex`) . 
- ** AnZhuangJiao this Zhi line ShiBai **: GuanFangJiao this in XieRu `merkle-tree-napi.win32-x64-msvc.node` ( or Tong directory XiaWenJian ) when by XiTongJuJueFangWen ( WenJian by Zhan use or DangQianJinCheng no ZuGouQuanXian ) , DaoZhi `cursor-agent\versions\<version>\` XiaRengQueShao or SunHuai , index.js not Ke use . 
- because Ci not " no have ZuoMi etc. XiuFu ", and is " XiuFu when AnZhuang because QuanXian / Zhan use ShiBai ", agent RengChu at SunHuaiZhuangTai . 

### 4.3 DaiMaCeYiZuoChuLi 

- in **CursorAgentPostInstallProcessor.ps1** in , DangAnZhuangShiBaiQieYiChangXinXiBaoHan `denied` or `Access to the path` when , HuiDuoDaYi line TiShi : GuanBi Cursor/agent Hou ** to GuanLiYuanShenFen ** Yun line : 
`irm 'https://cursor.com/install?win32=true' | iex` 
to Bian use HuAnTiShiZi line WanChengXiuFu . 

### 4.4 use HuCeJianYi 

1. ** GuanBiSuo have Cursor ChuangKou and agent JinCheng **, BiMianMuBiao directory by Zhan use . 
2. ** to GuanLiYuanShenFenDaKai PowerShell**, Zhi line : 
`irm 'https://cursor.com/install?win32=true' | iex` 
3. if RengBao Access denied, JianChaShaRuan / AnQuanRuanJian is FouLanJieXieRu `%LOCALAPPDATA%\cursor-agent`, Lin when PaiChu or YunXuHouZaiZhi line ShangShuMingLing . 
