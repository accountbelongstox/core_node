# MCP Server QiDongTiaoShi output JieJueFangAn - summary document 

to use HuTiGong `<content>` (MCP Server QiDongTiaoShi output JieJueFangAn ) JianMing summary . 

## structure 
- Markdown WenDang : WenTiFenXi JieJueFangAn YiTianJia TiaoShi output QiDong output ShiLi (PRIMARY/SECONDARY) JianChaHouDuanZhuangTai TuiJian use FangShi ZhuYiShi item WenJianXiuGaiJiLu . 
- HanDaiMa block (bash, batch, PowerShell) and ShiLi output . 

## key points 
- ** WenTi **: Yun line `python .\pymain.py app=mcp` no XianShi , Yuan because BaoKuo Python stdout HuanChong , to and Yi have PRIMARY ShiLi when XinJinCheng to SECONDARY QiDong . 
- ** JieJue **: use `python -u` or SheZhi `PYTHONUNBUFFERED=1`; KeXuanChuangJian start_mcp.bat/ps1 Jiao this . 
- ** TiaoShiGaiJin **: pymain.py ZengJiaQiDongHengFu ( GongZuo directory , project Gen , CanShu ) ; mcpserver_main.py ZengJiaQiDong when Jian , PID, CWD, config ( DuanKou 19997 singleton, 8767 RPC, TiaoShiMoShi ) etc. . 
- ** ShiLiMoShi **: PRIMARY Yun line MCP HouDuan ; SECONDARY JinZuoKeHuDuanLianJieYi have HouDuan ; Ke use netstat/lsof ChaDuanKou , taskkill/pkill TingZhi . 

## purpose 
JieJue MCP Server QiDong when no output WenTi , and note such as HeChaKanQiDongZhuangTai , QuFen PRIMARY/SECONDARY and ChongQiFangShi ; GongKaiFa and TiaoShi use . 
