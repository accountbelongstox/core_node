<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# AWY API 设计规则文档

## 1. 基础规则

### 1.1 API 版本与路径
- 基础路径前缀：`/api/awy/v0/`
- API版本通过路径前缀进行控制，如 v0、v1、v2 等
- 路径使用小写字母，单词间用下划线连接
- 资源采用复数形式命名，如 `/users`、`/devices`

### 1.2 HTTP 方法使用规范
- GET：获取资源
- POST：创建资源或执行操作
- PUT：更新资源（完整更新）
- PATCH：更新资源（部分更新）
- DELETE：删除资源

## 2. 认证与安全

### 2.1 Token认证
- 采用Bearer Token认证方式
- 在HTTP Header中添加：`Authorization: Bearer {token}`
- Token通过登录接口获取
- Token过期时间：24小时


### 2.2 统一返回格式
{
    status: number;
    message: string;
    code,
    data
}