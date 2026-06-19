# clientRegistrationHandler - summary document 

to use HuTiGong `<content>` (OAuth KeHuDuanZhuCe handler) JianMing summary . 

## structure 
- ES module : DaoRu express, OAuthClientMetadataSchema, crypto, cors, rateLimit, allowedMethods, CuoWuLei ; DaoChu clientRegistrationHandler({ clientsStore, clientSecretExpirySeconds, rateLimit, clientIdGeneration }) FanHui Router. Router: cors, allowedMethods(['POST']), express.json(), KeXuan rateLimit (1h/20 Ci ) ; POST '/' within safeParse body, QuFen public client, ShengCheng client_secret/client_id, registerClient, 201 or CuoWu JSON. 

## key points 
- ** MoRen **: clientSecretExpirySeconds for 30 Tian ; clientIdGeneration MoRen true; public client (token_endpoint_auth_method === 'none') no client_secret. 
- ** ShengCheng **: client_secret for crypto.randomBytes(32).toString('hex'); client_id for crypto.randomUUID(); client_id_issued_at, client_secret_expires_at An config JiSuan . 
- ** XianLiu **: express-rate-limit MoRen 1 Xiao when 20 Ci , KeGuan ; CuoWuFanHui TooManyRequestsError etc. . **CORS**: YunXuRenYi origin, Bian at Web/MCP KeHuDuan . 

## purpose 
ShiXian OAuth 2.0 DongTaiKeHuDuanZhuCe (RFC 7591 FengGe ) HTTP DuanDian , Gong MCP etc. Web KeHuDuanZhuCe and HuoQu client_id/client_secret, and clientsStore JiCheng . 
