# DD Shell KaiFa spec (Debian) - summary document [avqLR2]

to use HuTiGong `<content>` (DD Shell KaiFa spec - Debian XiTong ) JianMing summary . 

## structure 
AI GuiZeZhuShi project Gen directory ShengMing (RootDir: ../) GaiShu dd.sh Jiao this architecture (dd.sh + scripts/shells/ directory Shu ) Ji this KaiFa spec (LGar.sh YinRu , gvar_common.sh BianLiangJiaoHuan , ASCII/ YingWen , dd.sh not YinRu No. SanFang , CaiDan and Install the server) XuanZeQi spec (selector_common.sh, mode, set_var/get_var) CaiDan item - AnZhuang item spec (install.sh, install_shells, MingMing , LuJing , USE_SUDO, SiYaoSu ) install_shells KaiFa spec ( AnZhuangFangShi , BianLiang and LuoJi , QuanXian , link, /usr/local/bin, ZhuangTaiJi ) HeGuiBaoGaoShengChengZhiNan (.compliance/DD_SHELL_DEBIAN_COMPLIANCE_REPORT.md, JianChaQingDan ) . 

## key points 
- ** LuJing and BianLiang **: Suo have LuJing to $RootDir/ for JiZhun ; Jiao this JianBianLiangTongGuo gvar_common.sh set_var/get_var JiaoHuan ; BianLiangQuanDaXie . 
- **dd.sh**: not source RenHe No. SanFangWenJian , JinDiao use scripts/shells/ XiaJiao this ; ChangZhuCaiDan "Install the server" Diao use selector_common.sh, ZaiJing install.sh YiCiZhi line install_shells. 
- **install_shells**: MingMing indexx_scriptname.sh; KaiTouShe SCRIPT_CURRENT_DIR, PARENT_DIR, SCRIPT_INDEX; TuiJianSiYaoSu : HuanJingMingLingBianLiang , AnZhuangLaiYuan , HuanJingYanZheng , link to /usr/local/bin and ShuaXin ; DuoHuanJing use BianLiFu use ; TongYi USE_SUDO; ZhuangTaiJi : YuJianCe AnZhuangJueCe Zhi line AnZhuang HouXiuFu ZuiZhongYanZheng . 
- ** HeGuiBaoGao **: to MuBiaoJiao this AnQingDanZuo is / Fou / not Shi use PanDuan , BaoGaoShengCheng to $RootDir/.compliance/DD_SHELL_DEBIAN_COMPLIANCE_REPORT.md. 

## purpose 
spec dd.sh and Debian XiangGuan shell (common_functions, gvar_common, selector_common, install.sh, install_shells) KaiFa and HeGuiJianCha , BaoZheng structure , BianLiang , CaiDan and AnZhuangLiuChengYiZhi . 
