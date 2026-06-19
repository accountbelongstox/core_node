# build mc shell Jiao this - summary document 

to use HuTiGong `<content>` (ManageCenter GouJianJiao this ) JianMing summary . 

## structure 
- shebang `#!/bin/sh`; echo KaiShi / JieShuFenGeXian ; rm -rf ../bin/pyManageCenter; python3 CompilePy3Pyc.py LiangCanShu ( Yuan directory , MuBiao directory ) || exit 1; cp -f ../src/ManageCenter/*.py ../bin/ || exit 2. 

## key points 
- ** QingLi **: ShanChu ../bin/pyManageCenter directory . 
- ** BianYi **: CompilePy3Pyc.py Jiang ../src/ManageCenter/pyManageCenter/ BianYi output to ../bin/pyManageCenter/, ShiBaiZe exit 1. 
- ** FuZhi **: Jiang ../src/ManageCenter/*.py FuZhi to ../bin/, ShiBaiZe exit 2. 
- Jiao this use at "build mc" (ManageCenter) ZiDongHuaGouJian . 

## purpose 
in shell in YiJianWanCheng ManageCenter BianYi (pypyc/ ChanWu ) and RuKouJiao this FuZhi , GongBuShu or this Yun line use . 
