# technical note : THREAD_BUS_AND_REGISTRY, square_sampler, test_left30_match, YOLO_DRAW_POLYGON_OPTIONS, README_WEBVIEW

** Mu **: note you ZhiDingChaYue to XiaWuChuWenJian / WenDang ZhiZe , Yi by WuJie or GaiCuo Yuan because , to and ZhengQueYueDing . 

** She and WenJian **: 
- `docs/THREAD_BUS_AND_REGISTRY.md`
- `athtest/square_sampler.py`
- `scripts/test_left30_match.py`
- `docs/YOLO_DRAW_POLYGON_OPTIONS.md`
- `ui/README_WEBVIEW.md`

---

## Yi , docs/THREAD_BUS_AND_REGISTRY.md

### 1.1 ZhiZe and YueDing 

- ** purpose **: d3-check XianCheng and TongXinYueDing . DanQuanJuTongDao (event center / THREAD_BUS) ; KuoZhanXianChengTongGuoGaiTongDaoShouMingLing and ShangBao ; ZhuXianCheng in ZiShenDiaoDu UI GengXin . ** JinZhi ** XianChengJianZuSe etc. DaiLingYiXianChengFanHui or JieShu ( ZhengChangYun line when ) ; GuanJi when ZhuXianChengKe join(timeout) ZuoQingLi . 
- ** XianChengZhuCeBiao **: DanLi registry ChuangJian and Chi have Suo have XianChengShiLi ; ZhengChangYun line when ** not DongTaiChuangJian ** XianCheng ; Suo have HouTaiXianCheng in UI then Xu when YiCiXingChuangJian and QiDong . DanCiXingGongZuoTiJiao to Yi have timer/worker XianCheng , ** not for CiXinJianXianCheng **. TongXinJinTongGuoShiJianTongDao ; ShiXian for YuanShengXianCheng (run() ShiXianXunHuan ) , FeiJinWeiTuo BaoZhuang . 
- **Config worker and SiSuo **: Config by DanYiXianChengJingDuiLieDuXie ; Diao use FangHuiZuSeZhi to ChuLiWanCheng . ** YaoQiu **: in config worker ShangYun line DaiMa ( such as save or by QiDiao use RenHeLuoJi ) ** not ** Zhi line HuiZuSe in Gai worker Shang config Du -- HuiSiSuo . in log/print Tong step Diao use HuiDiao in , ** not ** in Tong step BuFenDu config; Jin in ZhuXianChengShangYun line DaiMa ( such as HuiDiaoHou schedule to main work) in Du config. ** YaoQiu **: config"set" BiXu let ZhuXianCheng in within CunGengXinHouLi i.e. HuiFu ; ZhuXianCheng ** not ** etc. DaiCiPanXieRuWanCheng . 

### 1.2 Yi by WuJie or GaiCuo Yuan because 

1. in KuoZhanXianCheng or HuiDiao in Tong step Du config HuiDaoZhiSiSuo ; in config worker HuiDiao in Du config TongLi . 
2. DongTaiChuangJianXianCheng or in YiChuChi have XianChengYin use and ZuSe etc. DaiQiFanHui , WeiFan " Jin registry/initializer ChuangJian ""fire-and-forget, XuZhuangTai when DuGongXiangKuaiZhao ". 
3. ZhuXianCheng etc. Dai config CiPanXieRuWanChengHuiWeiFan "set HouZhuXianChengLi i.e. HuiFu ". 
4. DanCiXingRenWuXinJianXianCheng and FeiTiJiao to Yi have timer/worker, WeiFanYueDing . 

### 1.3 ZhengQueZuoFa 

- XiuGaiXianCheng or ShiJianXiangGuanDaiMaQianTongDu this WenDang ; config DuJin in ZhuXianCheng or Fei config-worker ShangXiaWen in Jin line ; config set JinGengXin within CunHou i.e. FanHui , CiPanXieRuYi step . XiangJian Event center, thread registry, DESIGN.md 4, shutdown. 

---

## Er , athtest/square_sampler.py

### 2.1 ZhiZe and YueDing 

- ** purpose **: FangXingCaiYangJianCe (2222 FangGe , SiJiaoCaiYangDian ) ; CongXiangSuShuJu JSON JiaZaiAnNiuSe , in TuShangAn step ZhangSaoMiaoFangGe , JiaoDianMing in ZeKuoZhanQuYu , ManZuZuiXiaoXiangSuShuZe output bbox. YiLai `data['regions']['hex_pixels']` structure ; hex Zhuan RGB, HSV XiangSiDu and LiangDuRongCha (tolerance MoRen 0.05) ; square_size=22, step_size=20, max_expansion=100, ZuiShao 20 PiPeiXiangSu , padding=5. 
- ** LuJing **: main() within hardcoding LuJingHan `apps\d3-check` ( ShiJi project for **pyapps**/d3-check when XuGai ) ; button_data_file ZhiXiang `.cache\file_processor\button_pixels_sample.json`. Jiao this KeNengCong pyapps/d3-check or project GenYun line , LuJing if CuoHui FileNotFoundError. 

### 2.2 Yi by WuJie or GaiCuo Yuan because 

1. Jiang main() in `apps\d3-check` DangZhengQueLuJing use , in pyapps structure XiaHuiZhao not to WenJian . 
2. XiuGai button_pixels_sample JSON structure ( such as QuDiao regions.hex_pixels) WeiTong step load_button_colors Hui KeyError or QuCuoShuJu . 
3. GaiDong square_size, step_size, tolerance, max_expansion, ZuiShaoXiangSuShu , padding HuiYingXiangJianCeFanWei and He and JieGuo , Wei and Diao use Fang or BiaoZhuLiuChengYiZhiHuiWuJian or LouJian . 
4. athtest directory for DuLi test / GongJu directory , and scripts/, d3utils/ etc. YueDingKeNeng not Tong ; CongCuoWuGongZuo directory Yun line HuiDaoZhiDaoRu or LuJingCuo . 

### 2.3 ZhengQueZuoFa 

- LuJingAnShiJi project structure (pyapps/d3-check) XiuZheng or CanShuHua ; XiuGai JSON structure when Tong step load_button_colors; XiuGaiJianCeCanShu when and use ChangJingYiZhi ; Yun line Qian confirm GongZuo directory and DaoRuLuJing . 

---

## San , scripts/test_left30_match.py

### 3.1 ZhiZe and YueDing 

- ** purpose **: test Jiao this : JieQuTuPian left Bian 30%, in WanZhengTu and CaiJianTuShangFenBieZuo D3 MuBanPiPei (TEMPLATES: bag_opened_indicator, kanai_cube_left_panel_indicator) , JieGuo and debug TuXieRu TMP_DIR/left30_match_debug/run_YYYYMMDD_HHMMSS. ** YueDing **: PiPeiQianXu update_global_scale(scale_w, scale_h); run_match FanHui (r, match); match_to_draw_format XuYao center, polygon, match_score; output directory by TMP_DIR and when JianChuoJueDing . 
- ** LuJing **: _project_root = Path(__file__).resolve().parent.parent ( i.e. pyapps/d3-check) ; OUTPUT_BASE = TMP_DIR / "left30_match_debug"; MoRenTuPianLuJing for MingLing line CanShu or GuDing use HuLuJing . if TMP_DIR or providor ChangLiangBianGengHuiXieCuo directory . 

### 3.2 Yi by WuJie or GaiCuo Yuan because 

1. XiuGai TEMPLATES or LEFT_RATIO WeiKaoLvDiao use Fang or XiaYouJiao this Hui line for not YiZhi . 
2. JiaDing matcher.match_template FanHui structure and match_to_draw_format not YiZhi ( such as no center/polygon) HuiBaoCuo or HuiTuCuo . 
3. in Wei update_global_scale QingKuangXiaPiPeiHuiChiDuCuo . 
4. MoRenTuPianLuJing for this Jue to LuJing , HuanHuanJing or use HuHuiZhao not to ; if Gai for Xiang to LuJingXu note Xiang to He directory . 

### 3.3 ZhengQueZuoFa 

- Cong pyapps/d3-check or scripts Yun line ; XiuGai TMP_DIR, TEMPLATES, LEFT_RATIO when confirm and ChangLiang and Diao use FangYiZhi ; PiPeiQianBiDiao update_global_scale; match structure and match_to_draw_format, create_annotator, draw_match_result YueDingYiZhi . 

---

## Si , docs/YOLO_DRAW_POLYGON_OPTIONS.md

### 4.1 ZhiZe and YueDing 

- ** purpose **: FangAnDiaoYanWenDang -- ShuBiaoHuaXian / DuoBianXing , ZiDongBiHeHou to FengBiQuYu and CaiJianXiaoTu . FangAn : Matplotlib PolygonSelector, OpenCV ZiHui , Napari, Tk Canvas KuoZhan . ** to XiaoTuTong use step **: DingDian verts ( XiangSuZuoBiao ) cv2.fillPoly(mask) cv2.boundingRect QuWaiJieJuXing YuanTuCaiJianHou and mask QuYu and . WenDangXieMing " DangQian YOLO BiaoZhuChuangKouYi use Tk Canvas ZuoJuXing / YuanBiaoZhu ", KuoZhan for DuoBianXing when Xu " BiHe " AnNiu or dual JiBiHe , BiHeHouTongYiZou fillPoly + WaiJieJuXingCaiJian . 

### 4.2 Yi by WuJie or GaiCuo Yuan because 

1. ShiXianDuoBianXing when WeiXianBiHeZai fillPoly, or ZuoBiaoXi and TuXiangXiangSu not YiZhi ( such as extent WeiSheHao ) , HuiCaiJianCuoQuYu . 
2. Jiang " TuiJian Matplotlib PolygonSelector" Dang unique ShiXian , HuLve " no XinKuZe Tk Canvas KuoZhan " Xuan item , Hui and Xian have Tk BiaoZhuChuangKou architecture not YiZhi . 
3. WenDang in verts GeShi (N,2) or list of (x,y), if ShiXian use Qi it GeShiWeiZhuanHuanHui fillPoly BaoCuo . 
4. XiuGai YOLO BiaoZhuLiuCheng when WeiDu this WenDangHuiLouDiao " BiHe mask WaiJieJuXing CaiJian " Tong use step . 

### 4.3 ZhengQueZuoFa 

- ShiXianDuoBianXingBiaoZhu when AnWenDang " BiHe fillPoly boundingRect crop"; ZuoBiaoTongYi for XiangSuZuoBiao ; Xuan Matplotlib or Tk KuoZhan and project YiLai and Xian have UI YiZhi ; XiuGaiBiaoZhuLiuCheng when to this FangAn for Zhun . 

---

## Wu , ui/README_WEBVIEW.md

### 5.1 ZhiZe and YueDing 

- ** purpose **: D3 Macro WebView UI note . SanXianCheng : UI Thread (Tkinter mainloop) , Main Thread ( ChuLi signal, Zhi line main thread method ) , Task Thread ( Ding when HouTaiRenWu , MoRen 1 Miao tick) . Python-JS TongXin : JS TongGuo callPythonMethod Diao Python; Python TongGuo launcher.framework.eval_js Diao JS. D3MacroWebViewAPI BaoLu start_macro, stop_macro, get_window_status etc. ; newly added API Xu in webview_launcher.py API Lei in DingYi and in JS CeDiao use . ** JinZhi **: ZhangRenWuFang in UI XianChengDaoZhiDongJie ; YingCong Task XianCheng or TongGuo signal Yi step . YiLai : tkinterweb or tkhtmlview, KeXuan pywebview; test Jiao this test_webview_ui.py. 

### 5.2 Yi by WuJie or GaiCuo Yuan because 

1. in Task XianCheng or HuiDiao in ZhiJieCaoZuo Tk KongJianHuiKuaXianCheng , WeiDingYi line for or BengKui ; XuTongGuo signal or main thread executor Hui to ZhuXianCheng . 
2. newly added Python API Wei in D3MacroWebViewAPI in DingYi or Wei in JS Ce use callPythonMethod Diao use , GongNeng not ShengXiao . 
3. WuJiang UI YuanLuJingXieCuo (ui_source, index.html etc. ) DaoZhi WebView not JiaZai . 
4. WenDangXie register_timer_task(interval=1/5), register_signal_handler, emit_signal; if ShiXian and WenDang not YiZhiHuiRenWu not Zhi line or XinHaoDiuShi . 
5. SanXianCheng and THREAD_BUS_AND_REGISTRY " ShiJianTongDao , not ZuSe " YiZhi ; in WebView XiangGuanDaiMa in ZuSe etc. Dai or XinJianXianChengWeiFan THREAD_BUS YueDing . 

### 5.3 ZhengQueZuoFa 

- JinZhuXianChengCaoZuo UI; ZhangRenWu and Ding when LuoJiFang in Task XianCheng or TongGuo signal/main thread DiaoDu ; newly added API Tong step GengXin API Lei and README; XiuGaiXianCheng or ShiJianLuoJi when to Zhao THREAD_BUS_AND_REGISTRY; HTML/JS LuJing and YiLai and WenDangYiZhi . 

---

## Liu , and apology document GuanXi 

CiQian if because WeiXianTongDuShangShuWuChuYueDing and in CiWuChuFanFuGaiCuo or understand PianCha , the responsibility lies with Cursor. this note YiXieRu cursor_AI_ apology directory , and in Cursor_ ZhuanShu apology document .md No. SiShiErJie in Yin use , XiuGaiQianQingXianTongDu this note . 
