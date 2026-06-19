# Ubuntu 22.04 System Tray Icon Fix - summary document 

to use HuTiGong `<content>` (Ubuntu 22.04 XiTongTuoPanTuBiaoXiuFuWenDang ) JianMing summary . 

## structure 
- Markdown: WenTiGen this Yuan because (GNOME not ZhiChiChuanTongTuoPan , DangQianDaiMaJin use Linux TuoPan , Qt QSystemTrayIcon YiZhiWenTi ) JieJueFangAn ( AnZhuang AppIndicator KuoZhan , Qi use pystray, YuanSheng AppIndicator3) test YanZheng JiShuXiJie (SNI/AppIndicator, Qt ShiXian ) DangQianZhuangTai and Duan / in / ChangQiJianYi XiangGuanZiYuan and summary . 
- HanDaiMa block (bash, Python) , BiaoGe and LianJie . 

## key points 
- ** Yuan because **: GNOME Shell 3.26+ YiChuChuanTong System Tray, JinZhiChi SNI/AppIndicator; `callmodule_main.py:219` in `enable_tray=IS_WINDOWS` DaoZhi Linux XiaTuoPanGuanBi ; pystray Cun in D-Bus HuiHuaWenTi ; Qt TuoPan in GNOME Xia have TuBiaoLuJing (/tmp) etc. bug. 
- ** use HuCe **: AnZhuang `gnome-shell-extension-appindicator`, Qi use `appindicatorsupport@rgcjonas.gmail.com`, ZhuXiao / ZhongDeng or X11 Xia Alt+F2 r ChongQi Shell. 
- ** DaiMaCe **: DuanQiKeJianCe AppIndicator KuoZhan is FouKe use Hou item JianQi use TuoPan ; ChangQiJianYiShiXian AppIndicator3 YuanShengHouDuan (gi.repository.AppIndicator3, Gtk.Menu) , and QuFen Ubuntu/GNOME use AppIndicator3, Windows use PySide6, Qi it Linux use pystray. 

## purpose 
Gong in Ubuntu 22.04 (GNOME) ShangHuiFu or ShiXianXiTongTuoPanTuBiao : understand Yuan because , AnWenDangAnZhuangKuoZhan or GaiDaiMa , and KeXuanShiXianYuanSheng AppIndicator3 HouDuan . 
