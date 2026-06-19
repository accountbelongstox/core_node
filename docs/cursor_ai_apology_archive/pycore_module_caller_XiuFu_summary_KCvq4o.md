# pycore_module_caller QiDongWenTiXiuFu summary - summary document [KCvq4o]

to use HuTiGong `<content>` (pycore_module_caller.py QiDongWenTiXiuFu summary , 2025-12-18) JianMing summary . 

## structure 
WenDangFenJie : WenTi 1 ( QianDuanQiDongKaZhu , DuanKouChongTu ) and XiuFu 13; WenTi 2 (Frontend JinCheng defunct/zombie) and XiuFu 4; WenTi 3 (Dev QianDuan by WuSha ) and XiuFu 4; WenTi 4 (Tray D-Bus) and XiuFu 5; Qi it XiuFu 67; DuanKouFenPeiBiao , WanZhengDiao use Lian , test YanZheng , summary and XiuFuWenJianLieBiao (8 WenJian ) . 

## key points 
- ** DuanKou **: FRONTEND_PORT 30003100 ( BiMian and matrixui ChongTu ) ; vite.config MoRen 3100, strictPort:true; frontend_thread ChuanRu VITE_PORT/VITE_HOST. 
- ** JinCheng defunct**: subprocess use stdout=PIPE, stderr=STDOUT, HouTaiXianChengChiXuXiaoFei stdout, BiMianGuanDaoMan /SIGPIPE. 
- **Dev QianDuanWuSha **: launch_native_app Jin in frontend_mode=='production' when Ba frontend_port JiaRu ports_to_check, Dev MoShiTiaoGuo , BiMianShaDiaoYiQiDong Vite. 
- **Tray**: Linux Shang enable_tray=IS_WINDOWS, tray_type="pyside6". 
- ** Qi it **: audio_capture Xian frame_count ZaiSuan duration ZaiQingKong _frames; frontend_thread ZengJiaQiDongHengFu and AnGuanJianCiCaiSe output Vite RiZhi . 
- ** DuanKouFenPei **: matrixui 3000, pycore-management 3100, RPC v2 59000. 

## purpose 
JiLu pycore_module_caller and pycore-management QianDuanQiDong , sub JinCheng , tray, YinPin etc. WenTi Gen because and XiuGaiDian , Bian at HouXuWeiHu and PaiCuo . 
