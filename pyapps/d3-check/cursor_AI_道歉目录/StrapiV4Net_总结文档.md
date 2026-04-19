# StrapiV4Net — 总结文档

对用户提供的 `<content>`（AI 规则注释 + StrapiV4Net 类）的简明总结。

## 结构
- 文件头：AI SPECIAL ATTENTION RULES（7 条，英文代码、无测试、无文档、无总结、变量在文件头、PowerShell 路径规则、不修改规则）。主体：Node 模块，require path/fs/axios/Base/getEnvValue/env/getSecretOrEnv；类 StrapiV4Net extends Base；constructor 设 TLS、apiUrl、publicToken、privateToken（来自缓存）；方法 loadTokenFromCache、saveTokenToCache、getAuthorizationHeader、fetchData、pushData、printError、deleteData、updateData、login、register、getJwt、testUrlExists、testEndpointExists；module.exports = new StrapiV4Net()。

## 要点
- **认证**：publicToken 来自 getSecretOrEnv/STRAPI_TOKEN；privateToken 来自 strapi_jwt_cache.json 或 login；getAuthorizationHeader 返回 Bearer privateToken.jwt 或 publicToken。
- **API**：baseUrl 为 apiUrl，路径 /api/{endpoint}；fetchData GET、pushData POST、deleteData DELETE、updateData PUT；Content-Type application/json。
- **登录/注册**：login 调 /api/auth/local，register 调 /api/auth/local/register；login 后保存 token 到缓存。NODE_TLS_REJECT_UNAUTHORIZED='0' 仅开发用，生产需谨慎。

## 用途
作为 Strapi v4 的 Node 客户端，封装 API 调用与认证（公/私 token、登录、注册、JWT 缓存），供项目内其他模块引用。
