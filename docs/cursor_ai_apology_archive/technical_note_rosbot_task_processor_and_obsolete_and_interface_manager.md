# technical note : rosbot_task_processor, _obsolete_d3_macro_controller_optimized, interface_manager

** Mu **: note this SanChuDaiMa ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . Bian at HouXuXiuGai when not ZaiFanTongLeiCuoWu . 

** She and WenJian **: 
- `d3utils/rosbot_task_processor.py`
- `utils/_obsolete_d3_macro_controller_optimized.py`
- `d3utils/interface_manager.py`

---

## Yi , rosbot_task_processor.py

### 1.1 ZhiZe and YueDing 

- ** unique RuKou **: Ding when RenWu every 1 MiaoDiao use `process_rosbot_task()`, within BuDiao use `processor.process_task()`. 
- **2 Miao step Jin **: `process_task()` within use `_flow_tick_count`, JinDang `_flow_tick_count[0] % 2 == 0` when CaiZhi line flow ( i.e. ShiJi for every 2 MiaoYi step ) , and ROSBOT_FLOW WenDangYiZhi . 
- ** not in CiChuZuo refresh/notify**: Tick within ZhiDu flow KaiGuan , Diao flow Ku (`tick_bn_only_flow()`, `tick_flow_master()`) ; Suo have refresh, notify by flow Ku within BuDiao use (Approach 3) . 
- ** Zhi line ShunXu **: Xian `tick_bn_only_flow()`, Zai `tick_flow_master()`; DangLiang KaiGuan all Kai when , TongYi tick within LiangZhe all HuiZhi line . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. **1 Miao and 2 MiaoHunXiao **: RenWu every 1 MiaoPaoYiCi , but flow LuoJiZhi every 2 MiaoZhi line YiCi . if in CiChuGaiCheng " every 1 Miao all Pao flow", HuiPoHuai extension_flow deadline_tick etc. to 2 Miao for Dan position JiaShe . 
2. ** in process_task LiJia refresh/notify**: WenDangMingQueXie "Tick does not call third-party libs; it only invokes the flow library". if in CiChuZengJia `refresh_battlenet_status()`, `refresh_d3_status()` etc. , Hui and flow Ku within Bu refresh ChongFu or ShunXuCuoLuan . 
3. ** TiaoZheng bn_only and flow_master XianHouShunXu **: DangQianYueDing is BN-only Xian , flow_master Hou ; if DianDao or ZhiPaoQiYi and WenDangWeiGai , HuiDaoZhi " XianZhanWangZai F0/extension" LiuCheng not YiZhi . 
4. **is_flow_active() and KaiGuan ErCiDuQu **: DaiMa in 2s MenTongGuoHouZaiCiDuQu `get_bn_only_enabled()`, `get_flow_master_enabled()`, if by " YouHua " ChengZhiDuYiCi , KeNeng in JiDuan when JianChuangKou within and use HuQieHuanKaiGuan not Tong step . 

### 1.3 ZhengQueZuoFa 

- XiuGai flow step JinZhouQi or ShunXu when , BiXuTong step Kan `extension_flow_tick_step`, `flow_master_driver` and WenDang ROSBOT_FLOW_MERMAID / ROSBOT_FLOW_CHECKLIST. 
- not in `process_task()` within ZengJiaRenHe refresh, notify or No. SanFangDiao use ; ZhuangTaiShuaXinZhi in flow Ku or `run_full_status_refresh()` etc. MingQueRuKouJin line . 

---

## Er , utils/_obsolete_d3_macro_controller_optimized.py

### 2.1 ZhiZe and YueDing 

- ** MingQueFeiQi **: WenJianTouZhuMing OBSOLETE; and `controller.d3_macro_controller.D3MacroController` ChongFu , QieYiLai not Cun in `ui.diablo3_macro_ui_optimized.Diablo3MacroUIOptimized`, CongWeiJieRu main.py or http_bridge. 
- ** JinZuoCanKaoBaoLiu **: Lei within method Jun for `pass` or DaYinFeiQiTiShi ; not Ying by RenHeXinLuoJiYin use or JiCheng . 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** Wu use for " YouHuaBan " KongZhiQi **: if Kan to "Optimized" char Yang then Ba it DangZhuKongZhiQi use or Jie to main/http_bridge, HuiDaoZhiYun line when QueShaoZhenShi UI and LuoJi . 
2. ** in " YouHua " XuQiu when Gai this WenJian **: ZhenZhengShengXiao is `controller.d3_macro_controller.D3MacroController` and ShiJi use UI; XiuGai this WenJian not HuiYingXiangYun line line for , Fan and RongYiZaoCheng " Gai was wrong WenJian " KunHuo . 
3. ** ShanChu or HuiFu Diablo3MacroUIOptimized import**: ZhuShiYi note Gai UI not Cun in ; if QuXiaoZhuShi or ChangShiShiXianYi "Diablo3MacroUIOptimized" LaiPeiHe this WenJian , Hui and Xian have ZhuLiuChengTuoJie , YingTongYiZouXian have D3MacroController + Xian have UI. 

### 2.3 ZhengQueZuoFa 

- Suo have HongKongZhi , JiNeng config , start/stop_macro XiuGaiYiLv in `controller.d3_macro_controller` and to Ying UI ShangJin line . 
- this WenJianJinZuoLiShiCanKao , not JieXinYiLai , not HuiFuFeiQi import; if XuShanChuXu confirm no WenDang or Jiao this Yin use GaiLuJing . 

---

## San , d3utils/interface_manager.py

### 3.1 ZhiZe and YueDing 

- **D3InterfaceManager**: TongYiGuanLi D3 JieMianXinXiCaiJi , to WaiTiGongLiangZhongLuJing : 
- **Optimized ( ChuangKouHuanCun ) **: `collect_ui_info()`, `collect_bag_info_quik()`, use `UIRegionCollectorOptimized`. 
- **Anchor ( QuanPingMaoDian ) **: `collect_ui_info_anchor()`, `collect_bag_info_anchor()`, use `UIRegionCollectorAnchor`. 
- ** Xian UI HouBeiBao **: Suo have `collect_bag_info_*` JunXianDiao use to Ying `collect_ui_info*` ShuaXinPingMu and UI QuYu , ZaiCong shared data QuTuZuoBeiBaoJianCe ; not ShengLve " XianShuaXin UI" step . 
- ** no BeiBao when Song I ZaiShiYiCi **: `collect_bag_info_quik` / `collect_bag_info_anchor` in ShouCiWeiJianCe to BeiBao when , HuiXiang D3 FaSongAnJian I and etc. DaiHouZhongShiYiCi ; this is YueDingLuoJi , not YaoShanZiShanChu or Yi to BieChu . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** HunXiaoLiangZhongCaiJiFangShi **: Optimized and Anchor use not Tong collector, not TongBuHuoFangShi ( ChuangKouHuanCun vs QuanPing ) ; if in Diao use FangHun use ( Li such as use anchor UI JieGuoPei optimized bag) , or GaiCuo collector LeiXing , HuiDaoZhiZuoBiao / ChiDu not YiZhi . 
2. ** ShengLve " Xian collect_ui_info Zai collect_bag"**: if for " ShengYiCiDiao use " and ZhiJieDiao `_bag_collector.collect()` QieDang when shared data in no ZuiXin game_window_image, BeiBaoJianCeHuiJi at JiuTu or ShiBai . 
3. ** XiuGai force_new_capture / force_refresh MoRenZhi **: WenDangYueDing "ALWAYS refresh screen data first"; if Ba `force_new_capture=True` Gai for False or Ba " XianShuaXinZai bag" GaiCheng " have HuanCun then use HuanCun ", HuiWeiFan " Xian UI HouBeiBao " YueDing . 
4. **get_window_offset() and bag PianYi **: ZhuShiXieMing "Bag offset is already included in bag coordinates"; if in CiChuZaiJiaYiCeng bag PianYiHuiDaoZhiChongFuPianYi . 

### 3.3 ZhengQueZuoFa 

- newly added or XiuGaiCaiJiLuoJi when , MingQue use Optimized LuJingHai is Anchor LuJing , Qie UI and bag TongLuJingPei to . 
- BaoChi " Xian collect_ui_info ( or anchor) , Zai collect bag"; no BeiBao when " Song I ZaiShiYiCi " BaoLiu in interface_manager within . 
- ZuoBiao and ChiDu to shared data and get_scaled_* for Zhun ; not in get_window_offset() in ChongFuJia bag PianYi . 

---

## Si , and apology document GuanXi 

if CiQian because ShangShuRenYiDian ( such as : in rosbot_task_processor LiJia refresh, WuGai obsolete WenJian , or DaLuan interface_manager UIbag ShunXu ) DaoZhiFanFuGaiCuo or understand PianCha , KeShi for ShiXian and YueDing not YiZhiSuoZhi . this note as JiShuChenDianXieRu `cursor_AI_ apology directory `, and `Cursor_ ZhuanShu apology document .md` and Lie ; ZhuanShu apology document in YiTongGuo " technical note _rosbot_task_processor and obsolete and interface_manager" Yin use this WenJian , Bian at HouXuXiuGaiQianXianChaCiChuYueDing . 
