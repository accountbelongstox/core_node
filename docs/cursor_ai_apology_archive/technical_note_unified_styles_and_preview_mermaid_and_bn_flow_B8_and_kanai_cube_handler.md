# technical note : unified_styles, preview_mermaid, bn_flow_B8, kanai_cube_handler

** Mu **: note CiSiChuWenJian ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `ui/unified_styles.py`
- `docs/preview_mermaid.py`
- `.cache/bn_flow_snapshots/bn_flow_B8.json`
- `controller/ctl_func/kanai_cube_handler.py`

---

## Yi , ui/unified_styles.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: D3-Check TongYiYangShi : COLORS (primary, bg_*, text_*, btn_*, input_*, tab_* etc. ) , FONTS ( ZuiXiao 9px, Segoe UI/Consolas) , SPACING, PADDING, TAB_PAD, LINE_HEIGHT. configure_ttk_styles() config TNotebook, TNotebook.Tab, TFrame, TLabel, TButton, TEntry, TCombobox, TLabelframe etc. . create_styled_widget, apply_hotkey_label_style for FuZhu method . Quan project UI YingYin use this module YanSe and char Ti , Wu in KongJian within hardcoding SeZhi or char Ti and COLORS/FONTS not YiZhi . 
- ** YueDing **: GaiSeBan or char TiXu in CiChuGai and BaoChi COLORS/FONTS JianMingWenDing ; TNotebook.Tab padding [12,8,12,8] and expand etc. WuSuiYiGaiFouZeBiaoQianGaoDu not Yi ; Gao to BiDu Combobox selectbackground/selectforeground YiShe , Wu in BieChuFuGai . 

### 1.2 YiCuoDian 

- in KongJian within hardcoding #xxx or char Ti and unified_styles not YiZhiHuiFengGeFenLie ; Gai COLORS JianMingWeiQuanJuTiHuanHui KeyError; Gai FONTS Xiao at 9px HuiWeiFanZuiXiao char HaoYueDing . 

### 1.3 ZhengQueZuoFa 

- Suo have UI Se and char TiCong UnifiedStyles.COLORS/FONTS/SPACING/PADDING Qu ; XiuGaiQianTongDu configure_ttk_styles and create_styled_widget use Fa . 

---

## Er , docs/preview_mermaid.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: DuLiJiao this , Cong docs/ROSBOT_FLOW_MERMAID.md TiQu No. Yi ```mermaid block , use mermaid-cli XuanRan for SVG, XieRu docs/mermaid_preview/ROSBOT_FLOW.svg, and AnPingTai startfile/open/xdg-open DaKai . YiLai pip install mermaid-cli. and ZhuanShu apology document No. SanShiLiuJie , technical note _d4func and preview_mermaid and log_monitor in preview_mermaid YueDingYiZhi . 
- ** YueDing **: JinDuLiYun line ; LuJing doc_dir, md_path, out_dir, out_svg for Jiao this within ChangLiang ; not KeDangKu import HouDiao use ; Gai md or output LuJingXuTong step Jiao this . 

### 2.2 YiCuoDian 

- DangKu use or GaiLuJingWeiTong step HuiBaoCuo or XieCuo ; asyncio.run(run()) and ZhuYing use ShiJianXunHuanChongTu . 

### 2.3 ZhengQueZuoFa 

- Jin python docs/preview_mermaid.py Yun line ; GaiWenDang or output directory when Tong step Jiao this within ChangLiang . 

---

## San , .cache/bn_flow_snapshots/bn_flow_B8.json

### 3.1 ZhiZe and YueDing 

- ** purpose **: BN JieDian B8 KuaiZhao . structure : meta (node="B8", reason="B8_to_B9") + controls ( this WenJianKe for KongShuZu ) . and bn_flow_B5, B9 etc. TongLei ; meta.node Xu and BN JieDianMingYiZhi ; JinZuoTiaoShi / HuiFang , WuDangLiuChengLuoJi . 
- ** YueDing **: XiaoFeiFangKeNengYiLai meta.node, meta.reason, controls; Gai structure or Qing .cache Xu confirm YiLai ; Wu in flow FenZhi in Du this WenJianZuoJueCe . 

### 3.2 YiCuoDian 

- WuDangLiuChengDingYiGai ; meta.node and BN JieDianMing not YiZhiHui to ZhaoCuo ; controls for Kong and B5 etc. FeiKong structure not Tong , JieXi when XuRongCuo . 

### 3.3 ZhengQueZuoFa 

- ShiZuo B8 JieDianKuaiZhao ; meta.node and BN YiZhi ; Gai structure or QingHuanCunQian confirm YiLai . 

---

## Si , controller/ctl_func/kanai_cube_handler.py

### 4.1 ZhiZe and YueDing 

- ** purpose **: KaNaiMoFangCaoZuo : handle_upgrade_operation ( ShengJiHuangZhuang ) , handle_reforge_operation ( ZhongZhuHuangZhuang ) . YiLai get_game_interface_data() interface_type, bag_layout, window_offset, bag_coordinates, kanai_right_page_opened. AnNiuZuoBiaoLaiZi share.game_interface_data: get_scaled_kanai_put_material_button, get_scaled_kanai_right_panel_toggle, get_scaled_conversion_button, get_scaled_kanai_next_page_button. LiuCheng : JiaoYan interface_type=="kanai_cube" and bag_layout _reset_panel_to_first_page ( YiLai kanai_right_page_opened, GuanZeDianYiCi toggle DaKai , KaiZeDianLiangCiGuanZaiKai ) _navigate_to_page(shared_data, page_clicks) (upgrade for 2, reforge for 1) _process_yellow_items ( right JiWuPin , DianFangRuCaiLiao , DianZhuanHuan , etc. 2 Miao , ZaiDianZhuanHuan ) . get_state_aware_click_handler(), should_stop_assistant() every step Ke in Duan . DanLi get_kanai_cube_handler(). 
- ** YueDing **: interface_type, bag_layout, window_offset, kanai_right_page_opened, bag_coordinates by game_interface_data WeiHu , this module ZhiDu ; ZuoBiaoYiLv use get_scaled_* + window_offset ZhuanPingMuZuoBiao ; page_clicks and upgrade/reforge to YingGuanXiWuDianDao ; _reset_panel_to_first_page BiXu in _navigate_to_page QianQie right BanZuiZhong for DaKaiQie No. YiYe . 

### 4.2 YiCuoDian 

- in handler within ZiWeiHu kanai_right_page_opened Hui and game_interface_data not Tong step ; Gai page_clicks ( such as upgrade Gai for 1) HuiJinCuoYe ; bag_layout.items and bag_coordinates structure YiLai game_interface_data and bag_layout_detector YueDing , Gai structure Hui KeyError or ZuoBiaoCuo . 

### 4.3 ZhengQueZuoFa 

- ZhuangTai and ZuoBiaoJunCong get_game_interface_data() and get_scaled_* Qu ; XiuGaiQianTongDu handle_upgrade_operation/handle_reforge_operation step ShunXu and _reset_panel_to_first_page LuoJi . 

---

## Wu , and apology document GuanXi 

if CiQian because WeiXianTongDuShangShuSiChuYueDing and in CiSiChuFanFuGaiCuo or understand PianCha , the responsibility lies with Ji . this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document in ZengJia No. SanShiJiuJieYin use . 
