# technical note : POST_LOGIN_BATTLENET_CONTROLS, ui/theme/__init__, i18n_errors_zh

** Mu **: note this SanChuWenDang / DaiMa ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `docs/POST_LOGIN_BATTLENET_CONTROLS.md`
- `ui/theme/__init__.py`
- `providor/i18n/i18n_errors_zh.json`

---

## Yi , docs/POST_LOGIN_BATTLENET_CONTROLS.md

### 1.1 ZhiZe and YueDing 

- ** purpose **: ** ZhanWangDengLuHou ** ZhuJieMianKongJian ** YingWenBan ** CanKaoWenDang , and `docs/ DengLuHou ZhanWangYuanSu - KongJian note .md` within Rong to Ying ( TongYiShuJuYuan and LuoJi ) . ShuJuLaiYuan : TiaoShiAnNiuDaoChu and FuZhi to `docs/ DengLuHou ZhanWangYuanSu .json` (UI Automation, Chromium ZhanWang ) . BiaoGeLieChu BattlenetOperation Yi use KongJian : D3 game tab (game-nav-btn-D3CN) , Start game button area (play-btn-main / play-btn) ; LuoJi : name Han "Playing Now"/"Play"/" KaiShiYouXi " Qie is_enabled=false or name Han "Playing Now" Shi for in-game. To implement: Agreement checkbox, confirm login, on login screen, already logged in. 
- ** YueDing **: and BattlenetOperation, providor/constants/d3.py automation_id/name YiZhi ; and DengLuHou ZhanWangYuanSu .json and in WenKongJian note Tong step ; "To implement" for WeiShiXian item , DaiMaWuJiaDingYiCun in . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in YingWenWenDang not Tong step **: if ZhiGai in Wen note WeiGai POST_LOGIN_BATTLENET_CONTROLS.md ( or Fan of ) , LiangChu automation_id, LuoJiMiaoShu not YiZhi , HuiDaoZhiAnYingWenWenDangShiXian DaiMa and An in WenShiXian LuoJiFenCha . 
2. ** and DaiMa automation_id not YiZhi **: if BattlenetOperation or constants use game-nav-btn-D3, play-btn etc. and WenDangBiao not Tong ( ShunXu , PinXie , Duo / ShaoYi item ) , ZhanWangDianJiHuiShiBai or DianCuo . 
3. ** Ba To implement DangYiShiXian **: if LiuCheng in Diao use " TongYi item Kuan "" confirm DengLu "" is Fou in DengLuYe " etc. JieKou and WenDangRengBiao To implement, KeNengJieKou not Cun in or FanHuiZhiWeiYueDing , DaoZhiBaoCuo or WuPan . 
4. **JSON LuJing and WenDang not Fu **: WenDangXie "copied to docs/ DengLuHou ZhanWangYuanSu .json"; if ShiXianCong battlenet_ui_elements_*.json or Qi it LuJingDu , Xu in WenDang or DaiMa in TongYi note . 

### 1.3 ZhengQueZuoFa 

- XiuGaiZhanWangKongJian id/name or LuoJi when Tong step GengXin this WenDang and DengLuHou ZhanWangYuanSu - KongJian note .md, BattlenetOperation, constants; ShiXian To implement item Hou in LiangPianWenDang in Gai for Yi use and ZhuMingJieKou ; JSON LuJing and DaiMaDuQuLuJingYiZhi . 

---

## Er , ui/theme/__init__.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: UI ZhuTiBaoRuKou , ** JinDaoChu UITheme** (from .theme import UITheme; __all__ = ['UITheme']) . ZhuTiDingYi ( YanSe , char Ti , ChiCun ) in **ui/theme/theme.py** UITheme Lei in ; this WenJian not BaoHanJuTiYanSe / char Ti , ZhiZuoDanYi re-export. Diao use FangYing use `from ui.theme import UITheme` or `from ..theme import UITheme`, ZaiTongGuo UITheme.get_color(), UITheme.get_font(), UITheme.get_size(), UITheme.apply_to_root() etc. use . 
- ** YueDing **: Suo have UI ZuJianTongYiCong theme QuSe / char Ti / ChiCun ; not in ZuJian within hardcoding YanSe or char TiJianMing , ChuFei and UITheme in DingYi JianYiZhi ; newly added YanSe / char Ti / ChiCun when in theme.py in ZengJia , not in __init__.py in ZengJiaQi it DaoChu . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in __init__ in ZengJia or ShanChuDaoChu **: if in __init__.py in ZengJiaQi it from .theme import XXX or Gai for __all__ = ['UITheme', 'Other'], and " JinZhuTiDingYi , DanYi UITheme DaoChu " YueDing not Fu ; if ShanChu UITheme DaoChu , Suo have `from ..theme import UITheme` ZuJianHui ImportError. 
2. ** ZhiJieCong theme.theme DaoRu **: BuFenDaiMa use `from ui.theme.theme import UITheme` or `from .theme.theme import UITheme`; if JiangLai theme.py ZhongMingMing or ChaiChengDuoWenJian , ZhiJieDaoRu theme sub module HuiDuan ; TuiJianTongYi use `from ui.theme import UITheme` to BianZhiYiLaiBaoRuKou . 
3. ** in ZuJian within hardcode YanSe / char TiJian **: if in ZuJian in Xie get_color('my_custom_key') and theme.py in no CiJian , Yun line when BaoCuo or HuiTui to MoRen ; newly added JianYing in theme.py in DingYi . 
4. **UITheme and theme.py not Tong step **: if Ba UITheme LeiYi to Qi it module but __init__.py Reng from .theme import UITheme, XuBaoZheng .theme ZhiXiangXin position Zhi ; FouZe __init__ and ShiJiDingYi not YiZhi . 

### 2.3 ZhengQueZuoFa 

- __init__.py BaoChiZhiDaoChu UITheme; Diao use FangTongYi `from ui.theme import UITheme` ( or Xiang to LuJing ..theme) ; newly added YanSe / char Ti / ChiCun in theme.py UITheme in DingYi ; not in CiBao __init__ in ZuoDuo re-export or JuHe . 

---

## San , providor/i18n/i18n_errors_zh.json

### 3.1 ZhiZe and YueDing 

- ** purpose **: ** CuoWuLei ** WenAn ** in Wen ** FanYi , Gong i18n GuanLiQiAn key QuWen this . DangQian structure for **ui.error_messages.*** ( such as ui.error_messages.bag_offset_failed = " GengXinBeiBaoPianYiZhi config ShiBai ") . and i18n_errors_en.json etc. to Ying key structure YiZhi ; DaiMa in XianShiCuoWuTiShi when Xu use XiangTong key ( such as get_ui_text or i18n TiGong CuoWuWenAnJieKou ) . 
- ** YueDing **: key LuJing and DaiMa in Diao use YiZhi ; newly added CuoWuWenAn when in zh/en etc. YuYanWenJian in Tong step ZengJiaXiangTong key; WuZhiGai in WenWeiGaiYingWen ( or Fan of ) DaoZhiMouYuYanQueYi or XianShi key. 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. **key LuJing and DaiMa not YiZhi **: if DaiMa use ui.errors.bag_offset_failed and JSON for ui.error_messages.bag_offset_failed, HuiQu not to , XianShi key or HuiTui to MoRen . 
2. ** newly added / ShanChu key WeiTong step DaiMa **: in JSON in newly added key but DaiMaWeiGai use Gai key XianShi , or DaiMaGai use Xin key but JSON WeiTianJia , HuiQueYi or XianShi key. 
3. ** DuoYuYanWenJian structure not YiZhi **: if i18n_errors_en.json for ui.error_messages.* and i18n_errors_zh.json Gai for ui.error.*, i18n JiaZai or fallback HuiCuoLuan . 
4. ** and i18n_config or Qi it error config ChongFu **: if i18n_config.json in also DingYi error_messages structure , XuMingQue to NaChu for Zhun ( TongChang to i18n_errors_zh/en.json for FanYiYuan ) ; LiangChu key not YiZhiHuiDaoZhiQuCuoWenAn . 

### 3.3 ZhengQueZuoFa 

- CuoWuWenAn key and DaiMa in get_ui_text / CuoWuTiShiDiao use WanQuanYiZhi ; ZengShan key when Tong step GaiDaiMa and Suo have YuYan JSON; BaoChi ui.error_messages.* structure and i18n_errors_en.json YiZhi ; and i18n JiaZaiLuoJi (i18n_config, YuYanXuanZe ) YueDingYiZhi . 

---

## Si , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as POST_LOGIN and in WenKongJian note or BattlenetOperation not Tong step , ui/theme/__init__ DuoDaoChu or ZhiJieDaoRu theme.theme DaoZhiHouXuZhongGouDuanLian , i18n_errors_zh key and DaiMa or en structure not YiZhi ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for WeiXianTongDuYueDingSuoZhi . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md in ZengJia to this Wen Yin use . 
