# StrapiV4Net - summary document 

to use HuTiGong `<content>` (AI GuiZeZhuShi + StrapiV4Net Lei ) JianMing summary . 

## structure 
- WenJianTou : AI SPECIAL ATTENTION RULES (7 item , YingWenDaiMa , no test , no WenDang , no summary , BianLiang in WenJianTou , PowerShell LuJingGuiZe , not XiuGaiGuiZe ) . ZhuTi : Node module , require path/fs/axios/Base/getEnvValue/env/getSecretOrEnv; Lei StrapiV4Net extends Base; constructor She TLS, apiUrl, publicToken, privateToken ( LaiZiHuanCun ) ; method loadTokenFromCache, saveTokenToCache, getAuthorizationHeader, fetchData, pushData, printError, deleteData, updateData, login, register, getJwt, testUrlExists, testEndpointExists; module.exports = new StrapiV4Net(). 

## key points 
- ** RenZheng **: publicToken LaiZi getSecretOrEnv/STRAPI_TOKEN; privateToken LaiZi strapi_jwt_cache.json or login; getAuthorizationHeader FanHui Bearer privateToken.jwt or publicToken. 
- **API**: baseUrl for apiUrl, LuJing /api/{endpoint}; fetchData GET, pushData POST, deleteData DELETE, updateData PUT; Content-Type application/json. 
- ** DengLu / ZhuCe **: login Diao /api/auth/local, register Diao /api/auth/local/register; login HouBaoCun token to HuanCun . NODE_TLS_REJECT_UNAUTHORIZED='0' JinKaiFa use , ShengChanXuJinShen . 

## purpose 
as Strapi v4 Node KeHuDuan , FengZhuang API Diao use and RenZheng ( Gong / Si token, DengLu , ZhuCe , JWT HuanCun ) , Gong project within Qi it module Yin use . 
