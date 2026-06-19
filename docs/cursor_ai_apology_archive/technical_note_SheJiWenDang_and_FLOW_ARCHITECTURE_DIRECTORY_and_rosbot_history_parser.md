# technical note : SheJiWenDang .md, FLOW_ARCHITECTURE_DIRECTORY.md, rosbot_history_parser.py

** Mu **: note CiSanChuWenJian / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `docs/ SheJiWenDang .md`
- `docs/FLOW_ARCHITECTURE_DIRECTORY.md`
- `d3utils/rosbot_history_parser.py` ( Ling have `scripts/rosbot_history_parser.py` for not TongShiXian , structure JiaoJian ) 

---

## Yi , docs/ SheJiWenDang .md

### 1.1 ZhiZe and YueDing 

- ** purpose **: Login Try and Battle.net DiaoXianChongQi ** XiangXiSheJi **, and DESIGN.md He and use (DESIGN for ZongLan and SuoYin ) . 
- ** YueDing **: LiuCheng ** no Python XianCheng **, Jin subprocess taskkill + explorer ChongQi ; Battle.net LuJingLaiZi `CONFIG["battlenet"]["battlenet_path"]`; ChuangKouBiaoTiLaiZi `providor_index.BATTLE_NET_WINDOW_TITLES`; OCR DiaoXianGuanJianCi `config.constants.BATTLE_NET_DISCONNECT_KEYWORDS` ( MoRen `("Retry", " ZhongShi ")`) , ** RenYi ** i.e. PanDiaoXian ; ChangLiang (LOGIN_TRY_SCREENSHOT_DIR, LOGIN_TRY_TRIGGER_DEFAULT etc. ) in config.constants; handle_login_try within not YinRu threading/asyncio. 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in handle_login_try within Gai use threading or asyncio**: WenDangMingQue " no Python XianCheng ", if GaiHuiWeiFanSheJi . 
2. ** GaiChangLiangWeiTong step config.constants or WenDang **: LOGIN_TRY_*, BATTLE_NET_DISCONNECT_KEYWORDS etc. Xu and WenDang 2.4 YiZhi . 
3. ** LuJing or ChuangKouBiaoTiCongBieChuDu **: Battle.net LuJingJin CONFIG["battlenet"]["battlenet_path"], ChuangKouBiaoTiJin BATTLE_NET_WINDOW_TITLES, CongBieChuDuHuiCuo . 
4. ** DiaoXianPanDingGai for QuanBuPiPei or Zeng item Jian **: WenDang for " ShiBieWen this BaoHan ** RenYi ** GuanJianCi i.e. DiaoXian ", if Gai for QuanBuPiPei or Zeng item JianHui and 2.2 not Fu . 
5. ** Wei config or WeiJie to Battle.net ChuangKou when WeiTuiHua for QuanPingJieTu **: WenDangYaoQiuTuiHuaLuoJi , ShanDiaoHuiYiChang when no HuiTui . 

### 1.3 ZhengQueZuoFa 

- XiuGai Login Try / DiaoXianChongQiXiangGuanLuoJiQianXianDu this WenDang and DESIGN.md; not GaiLiuCheng for " no Python XianCheng "; ChangLiang and LuJingLaiYuan and WenDangYiZhi ; TuiHuaLuoJiBaoLiu . 

---

## Er , docs/FLOW_ARCHITECTURE_DIRECTORY.md

### 2.1 ZhiZe and YueDing 

- ** purpose **: DingYi ** JinLiang flow Ku ** (BN-only, Flow-master) , directory BuJu , DanYuanZhenXiang and RongYuDingYiXiaoChu . 
- ** YueDing **: BNStep/BNNode JinCun in at `flow_bn_only_state`; rosbot_flow_battlenet ** not ** DingYi BNNode or this BN ZhuangTai , JinTongGuo flow_bn_block_state get/set; LiangLiuCheng ** KeTongPaiYun line ** (BN-only Xian , Zai flow-master) , no HuChi ; tick entry not call third-party libs (Approach 3) ; flow_master_driver use extension_flow_state phase, no repetition DingYi extension phase. 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. ** in rosbot_flow_battlenet within DingYi BNNode or _current_node**: WeiFan 4 DanYuanZhenXiang , BN step and ZhuangTaiJin flow_bn_only_state. 
2. ** LiangLiuChengJiaHuChi or DianDaoShunXu **: 7 MingQue both can run same tick, order: BN-only first then flow-master. 
3. ** in process_task within ZhiJieDiao provider or battlenet_manager**: WeiFan "Tick entry does not call third-party libs". 
4. ** Gai flow_bn_only_state and rosbot_flow_battlenet ZhiZeFenGong **: state ChiSuo have BN step and ZhuangTai , battlenet Jin tick_battlenet_ready_flow and reset_flow_master_bn_block, not Yong have BN ZhuangTai . 
5. **reset_battlenet_flow_state and reset_flow_master_bn_block Hun use **: HouZheDiao reset_bn_block_state(False) (Flow-master BN block ) , QianZhe for deprecated alias. 

### 2.3 ZhengQueZuoFa 

- Gai BN LiuCheng or ZhuangTaiQianXianDu this WenDang 26; not in battlenet within DingYi BN step / ZhuangTai ; LiangLiuChengTongPai when BaoChiShunXu ; tick entry JinDiao flow Ku . 

---

## San , d3utils/rosbot_history_parser.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: An ** QianDao TAB + content_indent** JieXi RoS-BoT history.txt; Block for Session/Rift/Step; STEP_NAMES GuDingYuanZu ; JieShou "Success" and "Sucess" PinXie ; **4-tab ChongFu line not JianXin block **; earned An content_indent GuiShu ; session_accept to Rift keys have TeShuGuiZe (indent 0 or 1 QieFei Riftkeys) ; entry_ts use at when JianChuangGuoLv . 
- ** YueDing **: STEP_NAMES, _SUCCESS_DURATION_RE, _is_4tab_repeat, _content_indent, Block.get(key) use replace(" ","") PiPei ; last_rift_block_with_earned min_entry_ts and fallback YuYiJian docstring. 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. ** XiuGai STEP_NAMES or block QiShiPanDing **: HuiPoHuai and Xian have RiZhiGeShi JianRong . 
2. **4-tab line WuJianXin block **: WenDang and DaiMaGuiDing 4-tab Qie within RongChongFuDangQian step or last_stripped when not push Xin block . 
3. **Success/Sucess ZhiJieShouQiYi **: ZhengZeYiTong when JieShouLiangZhongPinXie , if ZhiBaoLiuQiYiHuiJieXiShiBai . 
4. **earned GuiShuGuiZeGaiCuo **: Session in indent 0 QieDai ts when content in 0; session_accept to Rift keys (i==0 or (i==1 and key Fei Riftkeys)) if GaiHuiCuoGuiShu . 
5. **scripts/rosbot_history_parser.py and d3utils Ban this HunXiao **: scripts Ban for JiaoJian structure (Session/Rift, no Step Ming ) , LiangWenJian not KeHun use or WuTiHuan . 

### 3.3 ZhengQueZuoFa 

- XiuGaiJieXiLuoJiQianXianDu this module docstring and block structure ; not Gai STEP_NAMES, 4-tab ChongFuYuYi , Success/Sucess ZhengZe ; QuFen d3utils and scripts LiangBan parser. 

---

## Si , and apology document GuanXi 

if CiQian because WeiXianTongDuShangShuSanChuYueDing ( SheJiWenDang no XianCheng and ChangLiangLaiYuan , FLOW_ARCHITECTURE LiangLiuCheng and DanYuanZhenXiang , rosbot_history_parser block and 4-tab YuYi ) and in CiSanChuFanFuGaiCuo or understand PianCha , the responsibility lies with Cursor. this note YiXieRu cursor_AI_ apology directory , GongHouXuXiuGaiQianChaYue . 
