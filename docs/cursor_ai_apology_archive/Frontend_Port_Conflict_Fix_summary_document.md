# Frontend Port Conflict Fix summary document 

to use HuTiGong <Frontend Port Conflict Fix> JianMing summary . 

## structure 
- WenTiGen this Yuan because ( SanDian ) , XiuFuFangAn ( WuChu ) , DuanKouFenPeiBiao , test YanZheng , Qi it XiuFu (THREAD_BUS, pyc QingLi ) , summary . 

## key points 
- ** Yuan because **: matrixui Zhan 3000, pycore-management also Pei 3000 ChongTu ; Vite DuanKou by Zhan when ZiDongDiZeng to 3002/3003, frontend_thread Reng etc. localhost:3000 no Xian etc. Dai ; no Chao when ; JinChengKe defunct. 
- ** XiuFu **: config.py FRONTEND_PORT=3100; vite.config.ts MoRenDuanKou 3100, strictPort:true; frontend_thread.py SheZhi VITE_PORT, VITE_HOST; audio_capture.py in QingKong _frames QianXianGenJuZhenShuJiSuan duration. 
- ** DuanKou **: matrixui 3000, pycore-management 3100, RPC 59000. 

## purpose 
JiLu pycore_module_caller Ka in etc. Dai 3000 Yuan because and JieJue step , Bian at HouXuPaiCha and YanZheng . 
