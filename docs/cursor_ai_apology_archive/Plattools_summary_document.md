# Plattools summary document 

this WenDang to use HuTiGong `<content>` (Plattools Lei ) ZuoJianMing summary . 

## WenJianTouBuGuiZe 
- **AI SPECIAL ATTENTION RULES**: DaiMaJin use YingWen ; not BianXie / Zhi line / XiuGai test ; not ChuangJian or GengXin `*.md` WenDang ; KaiFa and SiKaoGuoCheng in not Xie summary ; Suo have BianLiang in WenJianKaiTouShengMing ; PowerShell Jiao this not use Xiang to LuJing , not ZhiJiePinJie char FuChuan to BianLiang , Gai use Split-Path/Join-Path/Resolve-Path; not XiuGaiShangShuGuiZe . 

## YiLai and JiCheng 
- **require**: child_process (execSync, spawn, exec, spawnSync) , fs, path, Base (#@base) , readline. 
- **Plattools** JiCheng **Base**; GouZao when `initialWorkingDirectory`, `currentDir` QuZi `getCwd()`. 

## MingLingZhi line method 
- **cmd(command, info, cwd, logname)**: Yi step Promise, within Bu use spawnSync; ZhiChi cwd and HuiFu initialWorkingDirectory; ZhuYi spawnSync no LiuShi .on('data'), DangQianShiXianKeNeng no FaZhengQueShouJi stdout/stderr. 
- **execCommand / execCmdSync / cmdSync**: Ji at exec, HuiDiao in wrapEmdResult, ZhiChi cwd, logname. 
- **wrapEmdResult(success, stdout, error, code, info)**: No. ErCanShu in ShiXian in by WuFu for stdout, error WeiZhengQueChuanRu . 
- **execCmd**: Tong step execSync, Linux Xia shell for /bin/bash; ZhiChi cwd and HuiFuGongZuo directory . 
- **cmdAsync**: WeiTuo to cmd. 
- **spawnAsync**: spawn sub JinCheng , ZhiChi timeout, progressCallback; Yu (y/n) or (yes/no) ZiDongXie Y or Yes; close when resolve wrapEmdResult. 
- **spawnSync**: Promise BaoZhuang spawnSync, ShouJi stdout/stderr, close/error when resolve. 
- **execByExplorer / execByCommand**: Windows XiaTongGuo explorer or cmd /c Zhi line . 

## PingTai and QuanXian 
- **isWindows / isLinux**: YiJu process.platform. 
- **isCentos / isUbuntu / isDebian**: Du /etc/os-release PanDuan . 
- **isCommand(command)**: where (Windows) or which (Linux) JianCeMingLing is FouCun in . 
- **isAdmin()**: Windows XiaTongGuo NET SESSION PanDuan . 

## GongJu method 
- **byteToStr**: Buffer/ char JieZhuan UTF-8 char FuChuan . 
- **reloadSystemctl()**: Linux XiaZhi line systemctl daemon-reload ( DaiMa in Yin use os.platform, XuQueBao require('os') YiCun in ) . 

## purpose 
for project TiGongKuaPingTaiMingLing line Zhi line , GongZuo directory QieHuan , RiZhiJiLu , PingTai and QuanXianJianCe , GongQi it module Fu use . 
