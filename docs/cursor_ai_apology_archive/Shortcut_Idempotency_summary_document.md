# Shortcut Idempotency Implementation summary document 

this WenDang to use HuTiGong <Shortcut Idempotency Implementation> ZuoJianMing summary . 

## structure GaiLan 
- WenDang for Markdown, BaoHan : GaiShu and ZhuangTai , WenTiMiaoShu , JieJueFangAn ( HanDaiMaYin use ) , ZengQiangRiZhi , test Jiao this and YuQi output , GuanJianRiZhiHanYi , XingNengYingXiang , BianJieQingKuang , ShiXianXiJie , XiuGaiWenJianLieBiao , ShouYi , XiangGuanWenDang , YanZhengQingDan . 

## key points 
- ** WenTi **: every CiZhi line `python pymain.py app=matrix` all HuiChongJian or GengXinZhuoMianKuaiJieFangShi , i.e. Shi no BianHua . 
- ** FangAn **: `DesktopIconGenerator` in `create_shortcut` in XianPanDuanKuaiJieFangShi is FouCun in , ZaiTongGuo `_shortcut_needs_update()` BiJiaoMuBiaoLuJing , GongZuo directory , CanShu , MiaoShu , TuBiao ; if YiZhiZeZhiJieFanHuiXian have LuJing , not Zhi line ChuangJian / GengXin . 
- ** BiJiaoLuoJi **: LuJingJing `Path(...).resolve()` spec Hua ; TuBiaoAn Windows `path,index` GeShiQuLuJingBuFenZaiBiJiao ; RenYi item not YiZhi or no FaDuQuXian have XinXiZeFanHuiXuYaoGengXin . 
- ** RiZhi **: ShortcutManager output this HuaMingCheng , BAT LuJing , TuBiaoLuJing , config abstract etc. ; DesktopIconGenerator in TiaoGuo when output "Shortcut already exists and matches". 
- ** test **: `pyapps/matrix/test_shortcut_idempotency.py` ZhiChi `--runs`, `--delay`, KeDuoCiYun line YanZhengMi etc. and Hao when . 
- ** XingNeng **: ShouCiChuangJianYue 120150ms, HouXuTiaoGuoYue 4050ms, JianShao COM and CiPanXieRu . 
- ** BianJie **: YuYanQieHuanDaoZhiKuaiJieFangShiMingChengBianHua when HuiDuoChuYi not TongMingCheng KuaiJieFangShi ; TuBiao / MuBiao / MiaoShuBianGengHuiChuFaGengXin . 

## purpose 
GongKaiFa and WeiHuRenYuanKuaiSu Jie Matrix ZhuoMianKuaiJieFangShiMi etc. ShiXian , YanZheng step and PaiCuoCanKao . 
