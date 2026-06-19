# Nuxt Multi-App Namespace Architecture v7.0 - summary document [VBHjPf]

to use HuTiGong `<content>` (Nuxt DuoYing use MingMingKongJian architecture WenDang v7.0, 2025-11-12) JianMing summary . 

## structure 
WenDangFenJie : Ban this and ZhuangTai ; AI KaiFaZhiNan (common YouXian , JinZhiGai _build_dir, pages directory GuanLi rules and Entry Page MoShi ) ; HeXinYuanZe ( MingMingKongJianGeLi , WanZheng directory Shu , FeiQi apps/app_{namespace}/, Xin structure app_{namespace}_pages/, LuJingShiLi ) ; architecture Ceng (Namespace Registry, Route Detection, Configuration, API, Layout, Pages QieHuan and Factory, i18n) ; Common vs App-Specific to ZhaoBiao ; Namespace GuiZe DO/DON'T; TianJiaXinYing use step and CongFeiQi structure QianYi ; GuanJianWenJianBiao ; JiaoYanQingDan ; Chang use MoShi ; DangQianYing use LieBiao . 

## key points 
- ** YuanMa and GouJian **: JinXiuGai `poly_apps/nuxt_main/`, Yong not XiuGai `_build_dir/` (1:1 JingXiang ) . 
- **pages GuanLi **: pages/ for ZiDongGuanLi , JinYunXu index.vue, blank.vue, layouts/, INDEX.md; Suo have YuanMa in app_{namespace}_pages/, JinZhiZhiJieBianJi pages/; QieHuanYing use when QingKong and ChongXinCong app_{namespace}_pages/ FuZhiShangShuWenJian . 
- ** FeiQi structure **: apps/app_{namespace}/ and components_app_{namespace}/ etc. YiFeiQi , XuQianYi to app_{namespace}_pages/ Xia to Ying directory . 
- **common Ceng **: common/stores, common/composables, common/components/ui, common/theme etc. , XianKuoZhan common ZaiXieYing use DaiMa . 
- ** Ying use Ceng **: app_{namespace}_pages/ Han components ({namespace}_index/{Namespace}App.vue etc. ) , composables, stores, services, config, constants, i18n, layouts, theme, types; API QingQiuDai X-App-Namespace; useAppI18n He and QuanJu and Ying use i18n. 
- ** Jiao this **: switch-pages-directory.js QieHuanDangQianYing use pages; switch-app-entry-plus.js JingXiang + QieHuan + JianTing + QiDong dev. 

## purpose 
for poly_apps/nuxt_main DuoYing use Nuxt project TiGongTongYi MingMingKongJian , directory , pages ZiDongGuanLi , common and Ying use FenCeng and QianYi spec , GongKaiFa and AI assistant ZunXun . 
