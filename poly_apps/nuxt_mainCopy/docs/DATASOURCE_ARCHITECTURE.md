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

# 多数据源管理系统架构文档

## 项目概述

这是一个基于 Nuxt 4 的多数据源管理系统，支持多种认证方式、故障转移、负载均衡、数据聚合等高级功能。

## 系统架构

### 核心组件

```
├── types/
│   ├── datasource.ts          # 数据源类型定义
│   └── api.ts                 # API响应类型定义
├── stores/
│   ├── datasource.ts          # 数据源状态管理
│   └── index.ts               # 应用主状态管理
├── services/
│   ├── datasource/
│   │   └── manager.ts         # 数据源管理器
│   ├── api/
│   │   ├── enhanced-dashboard.ts  # 增强的仪表板API
│   │   └── ...
│   └── config/
│       └── endpoints.ts       # API端点配置
├── composables/
│   └── useDataSource.ts       # 数据源组合式API
├── plugins/
│   └── datasource.client.ts   # 客户端初始化插件
└── pages/
    ├── admin/
    │   └── datasources.vue    # 数据源管理页面
    └── examples/
        └── datasource-demo.vue # 使用示例页面
```

## 功能特性

### 1. 多种认证方式支持

- **JWT Token**: 支持Bearer token认证
- **API Key**: 支持自定义API Key认证
- **Bearer Token**: 标准Bearer token认证
- **Basic Auth**: HTTP基础认证
- **OAuth2**: OAuth2认证流程
- **Custom**: 自定义认证头

### 2. 高级请求功能

- **故障转移**: 自动切换到备用数据源
- **负载均衡**: 智能分发请求到健康的数据源
- **数据聚合**: 从多个数据源获取数据并合并
- **缓存管理**: 智能缓存机制提升性能
- **重试机制**: 自动重试失败的请求

### 3. 监控和管理

- **健康检查**: 定期检查数据源健康状态
- **错误日志**: 详细的错误记录和分析
- **性能统计**: 请求统计和响应时间监控
- **实时状态**: 实时显示数据源状态

## 使用方法

### 1. 基础使用

```typescript
// 使用特定数据源
const { request } = useDataSource();
const response = await request('primary-api', '/api/users');

// 使用预定义的API方法
const primaryApi = usePrimaryApi();
const dashboardData = await primaryApi.dashboard();
```

### 2. 高级功能

```typescript
// 故障转移请求
const response = await requestWithFailover(
  ['primary-api', 'secondary-api'],
  '/api/data'
);

// 数据聚合
const aggregatedData = await requestAggregate([
  { sourceId: 'primary-api', endpoint: '/api/users', key: 'users' },
  { sourceId: 'secondary-api', endpoint: '/api/posts', key: 'posts' }
]);

// 负载均衡
const response = await requestWithLoadBalancing(
  ['primary-api', 'secondary-api'],
  '/api/data'
);
```

### 3. 数据源管理

```typescript
// 添加新数据源
addDataSource({
  id: 'new-api',
  name: 'New API Server',
  baseUrl: 'https://api.example.com',
  auth: {
    type: AuthType.JWT,
    tokenKey: 'auth_token',
    headerKey: 'Authorization',
    prefix: 'Bearer'
  },
  routes: {
    users: '/api/users',
    posts: '/api/posts'
  },
  status: DataSourceStatus.ACTIVE
});

// 激活/停用数据源
activateDataSource('new-api');
deactivateDataSource('old-api');
```

## 配置说明

### 数据源配置结构

```typescript
interface DataSourceConfig {
  id: string;               // 唯一标识
  name: string;             // 显示名称
  description?: string;     // 描述
  baseUrl: string;          // 基础URL
  timeout?: number;         // 超时时间
  retryCount?: number;      // 重试次数
  headers?: Record<string, string>; // 默认请求头
  auth: AuthConfig;         // 认证配置
  routes: Record<string, string>; // 路由映射
  status: DataSourceStatus; // 状态
  priority?: number;        // 优先级
  tags?: string[];          // 标签
}
```

### 认证配置

```typescript
interface AuthConfig {
  type: AuthType;           // 认证类型
  tokenKey?: string;        // Token存储键
  headerKey?: string;       // 请求头键
  prefix?: string;          // Token前缀
  apiKey?: string;          // API Key
  username?: string;        // 用户名
  password?: string;        // 密码
  customHeaders?: Record<string, string>; // 自定义头
}
```

## 最佳实践

### 1. 数据源配置

- 为每个数据源设置合适的超时时间和重试次数
- 使用有意义的标签对数据源进行分类
- 定期检查和更新认证信息

### 2. 错误处理

- 实现适当的错误处理和用户反馈
- 使用故障转移确保服务可用性
- 监控错误日志并及时处理问题

### 3. 性能优化

- 合理使用缓存减少不必要的请求
- 使用负载均衡分散请求压力
- 定期清理过期的缓存数据

### 4. 安全考虑

- 安全存储认证信息
- 使用HTTPS确保数据传输安全
- 定期更新API密钥和令牌

## 扩展开发

### 添加新的认证方式

1. 在 `AuthType` 枚举中添加新类型
2. 在 `buildAuthHeaders` 方法中实现认证逻辑
3. 更新UI界面支持新的认证配置

### 添加新的请求策略

1. 在 `DataSourceManager` 中实现新的请求方法
2. 在 `useDataSource` composable 中暴露新方法
3. 添加相应的类型定义和文档

### 自定义数据转换

```typescript
const response = await request('api-id', '/endpoint', {
  transform: (data) => {
    // 自定义数据转换逻辑
    return processedData;
  }
});
```

## 监控和调试

### 健康检查

系统会自动执行定期健康检查，也可以手动触发：

```typescript
// 检查特定数据源
await healthCheck('primary-api');

// 检查所有数据源
await healthCheck();
```

### 错误日志

所有请求错误都会被记录，可以通过以下方式查看：

```typescript
const { errors } = useDataSource();
console.log(errors.value);
```

### 性能统计

```typescript
const { stats } = useDataSource();
console.log({
  totalRequests: stats.value.totalRequests,
  successRate: stats.value.successfulRequests / stats.value.totalRequests,
  averageResponseTime: stats.value.averageResponseTime
});
```

## 部署注意事项

1. **环境变量**: 在生产环境中使用环境变量配置敏感信息
2. **CORS设置**: 确保API服务器正确配置CORS
3. **网络安全**: 使用防火墙和VPN保护内部API
4. **监控告警**: 设置监控告警及时发现问题

## 故障排除

### 常见问题

1. **认证失败**: 检查token是否过期，认证配置是否正确
2. **网络超时**: 调整超时时间，检查网络连接
3. **CORS错误**: 检查API服务器CORS配置
4. **缓存问题**: 清除缓存或禁用缓存进行测试

### 调试技巧

1. 使用浏览器开发者工具查看网络请求
2. 检查控制台错误日志
3. 使用健康检查功能测试连接
4. 查看数据源管理页面的状态信息