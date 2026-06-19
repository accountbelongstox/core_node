# MCP Server QiDongTiaoShi output JieJueFangAn - summary document [YvLxyE]

to use HuTiGong `<content>` (MCP Server QiDongTiaoShi Markdown WenDang ) JianMing summary . 

## structure 
- BiaoTi and WenTiFenXi : Yun line python pymain.py app=mcp no XianShi LiangLeiYuan because --(1) Python stdout HuanChong , (2) HouDuanYiYun line , XinShiLi for SECONDARY. 
- JieJueFangAn : FangAn 1 use python -u; FangAn 2 SheZhi PYTHONUNBUFFERED (CMD/PowerShell/Git Bash) ; FangAn 3 ChuangJian start_mcp.bat or start_mcp.ps1. 
- YiTianJiaTiaoShi output : pymain.py QiDongHengFu ( GongZuo directory , project Gen , MingLing line CanShu ) ; mcpserver_main.py QiDongXinXi ( when Jian , PID, CWD, config such as DuanKou , TiaoShiMoShi ) . 
- QiDong output ShiLi : PRIMARY ( ShouCi ) and SECONDARY ( HouDuanYiYun line ) WanZheng output ShiLi ; Singleton 19997, RPC 8767. 
- JianChaHouDuanZhuangTai : netstat/lsof ChaDuanKou ; taskkill/pkill TingZhiShiLi . 
- TuiJian use FangShi , ZhuYiShi item , WenJianXiuGaiJiLu (pymain.py, mcpserver_main.py line Hao ) . 

## key points 
- BiXu use python -u or PYTHONUNBUFFERED=1 CaiNengKan to Shi when output ; PRIMARY/SECONDARY by Singleton JianCeJueDing . 

## purpose 
note MCP Server QiDong no XianShi Yuan because and JieJueBanFa , to and such as HeQuFenZhuCongShiLi , JianChaDuanKou and AnQuanChongQi . 
