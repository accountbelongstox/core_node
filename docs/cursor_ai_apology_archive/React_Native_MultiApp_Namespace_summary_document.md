# React Native Multi-App Namespace Architecture summary document 

this WenDang to use HuTiGong <React Native Multi-App Namespace Architecture> ZuoJianMing summary . 

## structure GaiLan 
- WenDang for Markdown, BaoHan : Ban this and ZhuangTai , AI KaiFaZhiNan ( YouXianKuoZhan common/, JinZhiGai _build_dir) , HeXinYuanZe ( MingMingKongJianGeLi , directory structure Shu ) , architecture Ceng ( RuKou and APP_ENTRY, DaoRuLuJingGuiZe , ZiYuanGuanLi , build config ) , MingMingKongJianGuiZe (DO/DON'T) , newly added Ying use Qi step , YanZhengQingDan , GouJianXiTong note . 

## key points 
- **common YouXian **: XianKuoZhan `src/common/` (components, utils, services, hooks, types etc. ) , ZaiXieYing use ZhuanShuDaiMa ; common BaoChiTong use , not FangRuYing use YeWuLuoJi . 
- ** JinGaiYuanMa **: Zhi in `poly_apps/react_native/` XiuGai , not XiuGai `_build_dir/` ( ZiDongTong step JingXiang ) ; BaoCuoLuJingXuZhuanHuan for to YingYuanMaLuJing . 
- ** MingMingKongJianGeLi **: every Ying use have unique namespace; Ying use DaiMa in `src/apps/{namespace}/`, directory to `{namespace}_` for QianZhui (pages, components, navigation, theme, store, services, hooks, types) ; BiBei `App.tsx`, `build_config.ini`, `{namespace}_assets.ts`. 
- ** RuKou and FaXian **: TongGuo `APP_ENTRY` XuanZeYing use ; ZiDongSaoMiao `src/apps/`, no XuEWai config WenJian ; RuKou for `index.js` and `app-registry.ts`. 
- ** DaoRu and ZiYuan **: BiXu use LuJingBieMing `@/common/*`, `@/apps/{namespace}/*`, JinZhiXiang to LuJing ; ZiYuanBiXu in `common_assets.ts` or `{namespace}_assets.ts` in ZhuCe , DaiMaJinTongGuo key Yin use . 
- ** newly added Ying use **: ChuangJian `src/apps/{namespace}/`, `App.tsx`, `build_config.ini`, MingMingKongJianQianZhui directory , `{namespace}_assets.ts`, in `assets/apps/app_{namespace}/` FangZhiPingTaiZiYuan and ZhuCe , SheZhi `APP_ENTRY` i.e. Ke . 
- ** GouJian **: GongChangJingXiang for every Ying use ShengChengDuLiGouJian directory ; ZiYuanTiHuanGuanXian in GouJianQianKaoBeiYing use ZiYuan , GouJianHouHuiFu ; ZhiChi Debug, Build, Test MoShi . 

## purpose 
GongTuanDuiTongYi understand DuoYing use React Native GongZuoQu structure , MingMingKongJian spec and GouJianLiuCheng , Bian at newly added Ying use and WeiHu . 
