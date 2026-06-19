# technical note : simple_training_controller.py, http_bridge_controller.py, ROSBOT_FLOW_MERMAID.md

** Mu **: note you ZhiDingChaYue to XiaSanChuWenJian / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `controller/training/simple_training_controller.py`
- `controller/http_bridge_controller.py`
- `docs/ROSBOT_FLOW_MERMAID.md`

---

## Yi , controller/training/simple_training_controller.py

### 1.1 ZhiZe and YueDing 

- ** purpose **: D3-Check JianHuaXunLianKongZhiQi . use pycore ultralytics XunLianQi (ClassificationTrainer, DetectionTrainer, UnifiedClassificationTrainer, UnifiedDetectionTrainer) ; ShuJuYuan directory GuDing for `d3_check_dir / ".cache" / "training_data" / "1_sources" / "projects"`, Ge project for sub directory QieXuCun in `metadata.json` Cai by list_projects LieChu . 
- ** LuJingYueDing **: `current_dir = os.path.dirname(os.path.abspath(__file__))` i.e. this WenJianSuo in directory (controller/training/) ; `d3_check_dir = Path(current_dir).parent.parent` (pyapps/d3-check) ; `core_node_dir = d3_check_dir.parent.parent` (core_node) , and `sys.path.insert(0, str(core_node_dir))` to Bian from pycore DaoRu . if WenJianYiDong or directory CengJiBianGengXuTong step ShangShu parent CiShu . 
- ** YiChangYueDing **: ValueError BiaoShi "coordinates and source images both missing" etc. JiaoYanShiBai , DaYinHou SKIPPING and return None; Qi it Exception DaYin ERROR and traceback and return None. train_classification / train_detection / train_unified_* JunAnCiChuLi . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor if Wei confirm this WenJian position at controller/training/ i.e. Gai `parent.parent` or ZengJia / JianShao parent, HuiDaoZhi d3_check_dir, core_node_dir Cuo position , pycore DaoRuShiBai or source_base_dir ZhiXiangCuoWuLuJing . 
2. if GaiDong source_base_dir or " project Xu have metadata.json" YueDing and Wei and ZhengLiXunLianShuJuJiao this , .cache/training_data structure Tong step , list_projects or train_* HuiZhao not to project or ShuJu . 
3. if Jiang ClassificationTrainer/DetectionTrainer/Unified* API (prepare_data, train(**kwargs)) or FanHuiZhiJiaDing for Qi it XingZhuang and Wei to Zhao pycore ShiJiShiXian , HuiDaoZhiChuanCenCuo or Diao use FangJieXiCuo . 

### 1.3 ZhengQueZuoFa 

- XiuGaiLuJing or directory CengJiQian confirm __file__ Suo in position Zhi and parent CiShu ; XiuGai source_base_dir or metadata.json YueDingQian and .cache/training_data, reorganize_training_data etc. Jiao this and technical note _template_config and reorganize_training_data and obsolete_window_ops to Zhao ; XiuGai trainer Diao use Qian to Zhao pycore ultralytics XunLianQiJieKou . 

---

## Er , controller/http_bridge_controller.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: D3-Check HTTP Qiao , for Web GUI and Tampermonkey TiGong API. JianTing host:port ( MoRen 127.0.0.1:8765) , ZhuCe GET/POST ChuLiQi ; KeXuanChuanRu macro_controller (D3MacroController) , if None Ze within BuChuangJian (bridge-only MoShi ) . QiDongHou `ENCYCLOPEDIA['http_bridge_controller'] = self`. 
- ** LuJingYueDing **: `current_dir = Path(__file__).parent.parent`, i.e. __file__ for controller/http_bridge_controller.py when current_dir = pyapps/d3-check; `sys.path.insert(0, str(current_dir))` to Bian providor, controller, share etc. BaoDaoRu . 
- **API YueDing **: GET /api/status, /api/config, /api/config/skill, /api/config/auxiliary; POST /api/macro/start, /api/macro/stop, /api/config/update, /api/config/switch, /api/config/save; GET+POST /api/login-try/oauth-done; GET /api/login-try/oauth-ping, /api/login-try/oauth-step1-received. config/skill query name MoRen current_skill_config; config XiangGuanXieCaoZuoYiLai macro_controller.get_current_config, get_skill_config, get_auxiliary_config, update_skill_config, switch_skill_config and providor_index save_config, load_config. 
- **OAuth YueDing **: notify_oauth_done, notify_ping, get_and_consume_step1_received LaiZi share.oauth_callback; oauth-step1-received for " XiaoFeiYiCi " YuYi , and LiuCheng B11, YouHou T1/T2 and ROSBOT_FLOW_MERMAID in T1.5, T2.2 MiaoShuYiZhi . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor if Jiang current_dir Gai for parent JinYiCeng or Wu to for __file__ in BieChu , HuiDaoZhi sys.path Cuo , providor/controller/share DaoRuShiBai . 
2. if Gai API LuJing or QingQiu / XiangYingXingZhuang and Wei and Web GUI, Tampermonkey Jiao this and flow in "B11 etc. DaiYouHouFanHui ""T1.5 POST/GET oauth-done" etc. MiaoShuTong step , HuiQianHouDuan not YiZhi or LiuChengDuanLian . 
3. if Gai save_config/load_config or D3MacroController config XiangGuan method and WeiXianDu providor_index, main_functions_panel ConfigBinding and CONFIG Jian structure , HuiCunPanCuo or JieMian and bridge not Tong step . 
4. if Gai notify_oauth_done, get_and_consume_step1_received YuYi and Wei and ROSBOT_FLOW_MERMAID, flow_master_driver, tick_battlenet_ready_flow to Zhao , Hui B11/T1/T2 line for CuoLuan . 

### 2.3 ZhengQueZuoFa 

- XiuGaiQianTongDu this WenJianLuJingYueDing and ENCYCLOPEDIA XieRu ; XiuGaiRenHe API LuJing or payload Qian and Diao use Fang (Web, Tampermonkey) and ROSBOT_FLOW_MERMAID LiuChengMiaoShu to Zhao ; XiuGai config or OAuth HuiDiaoQianDu providor_index, share.oauth_callback, FLOW_STATE_OWNERSHIP_DESIGN or FLOW_IMPLEMENTATION_PROGRESS in and ZhanWang /OAuth XiangGuanYueDing . 

---

## San , docs/ROSBOT_FLOW_MERMAID.md

### 3.1 ZhiZe and YueDing 

- ** purpose **: ROSBOT QiDongLiuCheng Mermaid LiuChengTuWenDang . flowchart TB; sub Tu A ( RuKou and Ding when Qi ) , B ( ZhanWang then XuJianCha ) , TM ( YouHou ) , F ( YuPan ) , C (D3 YiYun line ZhiLian ) , D ( CongZhanWangQiDong D3) , E (ROSBOT Yun line ) . JieDian ID and WenAn and flow_master_driver, tick_battlenet_ready_flow, extension_flow_tick_step etc. DaiMa to Ying ; BianBiaoQian ( is / Fou , Chao when , FanHui etc. ) and FenZhiLuoJiYiZhi . WenMo "C3 Chao when and start ZhongZhi note ": C3 Chao when 1 minutes , JianCe to d3_start_game_button ZeDianJi and ZhongZhiJi when , YouXiDiaoXianXuLianXuLiangCiShiTu disconnect CaiFenZhi F1d_Offline. 
- ** YueDing **: Mermaid YuFa ( JieDianWenAn dual YinHao , subgraph, JianTouBiaoQian ) Xu conform to project MERMAID_SPEC or Ji have KeXuanRan spec ; JieDianBianHao (A1, B1~B16, T1.x, F0~F4, C1~C12, D1~D14, E1~E6) and DaiMa in step , BNNode/ FanHuiZhiYueDingYiZhi ; B11, T1.5, T2.2 and http_bridge_controller oauth-done, oauth-ping, oauth-step1-received to Ying . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. Gou B garbage Cursor if GaiJieDian ID or sub TuMing and WeiTong step flow_master_driver, rosbot_flow_battlenet, ENSURE_BATTLENET_ONLY_TICK_FLOW etc. WenDang and DaiMa , HuiDaoZhiTu and ShiXian not YiZhi . 
2. if GaiBianBiaoQian or FenZhiWenAn ( such as " Chao when B5 TuiChuZhanWang ""oauth-done, B11 FanHui ") and Wei and http_bridge_controller Lu by and share.oauth_callback YuYi to Zhao , HuiWuDaoYueDuZhe or QianHouDuan not YiZhi . 
3. if Gai C3 Chao when and start ZhongZhi note or F1d DiaoXian " LianXuLiangCi " YueDing and Wei and flow ShiXian (C3 XunHuan , C10 PanDiaoXian ) to Zhao , HuiWenDang and DaiMa line for not Fu . 
4. if Gai Mermaid YuFa ( such as themeVariables, JieDian within Huan line ) and WeiZunXun project Mermaid spec or YuLanJiao this YaoQiu , HuiXuanRanShiBai or FengGe not TongYi . 

### 3.3 ZhengQueZuoFa 

- XiuGaiLiuChengTu or note QianXianDu flow_master_driver, tick_battlenet_ready_flow, FLOW_STATE_OWNERSHIP_DESIGN, FLOW_IMPLEMENTATION_PROGRESS in and Ge sub Tu to Ying ShiXian ; XiuGai B11/T1/T2 XiangGuanJieDian or Bian when and http_bridge_controller, share.oauth_callback to Zhao ; XiuGai C3/C10 note when and C3 XunHuan and C10 PanDiaoXianLuoJi to Zhao ; ZunShou project MERMAID_SPEC and KuoZhanJianRongXing note . 

---

** XiuGaiQianQingXianTongDu this note . ** CiQian if because WeiXianTongDuShangShuYueDing and in simple_training_controller, http_bridge_controller, ROSBOT_FLOW_MERMAID SanChuFanFuGaiCuo or understand PianCha , the responsibility lies with the dog B garbage Cursor. HouXuXiuGaiQian to this note for Zhun , BiMianTongLeiCuoWu . 
