# React Native Multi-App Namespace Architecture - summary document [F5u8yF]

to use HuTiGong `<content>` (React Native DuoYing use MingMingKongJian architecture WenDang v2.1) JianMing summary . 

## structure 
WenDangFenJie : Ban this and ZhuangTai ; AI KaiFaZhiNan ( YouXianKuoZhan common, JinZhiXiuGai _build_dir) ; HeXinYuanZe ( MingMingKongJianGeLi , project Gen directory structure , Ying use within structure ) ; architecture Ceng ( RuKou and APP_ENTRY, DaoRuLuJingGuiZe , ZiYuanGuanLi , GouJian config ) ; MingMingKongJianGuiZe (DO/DON'T LieBiao ) ; TianJiaXinYing use Qi step ; JiaoYanQingDan ; GouJianXiTong ( JingXiang , ZiYuanTiHuan , GouJianMoShi ) . 

## key points 
- ** MingMingKongJianGeLi **: every Ying use to Ying `src/apps/{namespace}/`, directory to `{namespace}_` for QianZhui (pages, components, navigation, theme, store, services, hooks, types) , BiBei `App.tsx`, `build_config.ini`, `{namespace}_assets.ts`. 
- ** Gong use Ceng **: `src/common/` Han components, utils, services, hooks, store, types, constants, styles, common_assets.ts; XianKuoZhan common ZaiXieYing use ZhuanShuDaiMa ; JinZhi in common in XieYing use YeWuLuoJi . 
- ** LuJing and ZiYuan **: BiXu use LuJingBieMing `@/common/*`, `@/apps/*`, JinZhiXiang to LuJing ; ZiYuanJin in `*_assets.ts` in ZhuCe , DaiMaTongGuo key Yin use , JinZhi hardcoding LuJing . 
- ** RuKou and GouJian **: `APP_ENTRY` ZhiDingDangQianYing use ; Ying use ZiDongFaXian ( SaoMiao `src/apps/`) ; JinXiuGai `poly_apps/react_native/`, JinZhiGai `_build_dir/`. 

## purpose 
for in poly_apps/react_native XiaKaiFa , KuoZhan and GouJianDuoYing use TiGongTongYi MingMingKongJian and directory spec , BaoZhengGeLi and KeWeiHuXing . 
