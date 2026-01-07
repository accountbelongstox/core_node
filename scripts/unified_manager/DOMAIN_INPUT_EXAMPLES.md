# 域名输入示例 (Domain Input Examples)

## 支持的输入格式

系统支持以下任意组合的分隔符：
- **空格** (一个或多个)
- **逗号** `,`
- **分号** `;`

正则表达式：`r'[,;\s]+'` - 支持任意数量的空格、逗号或分号组合

## 输入示例

### 1. 单个域名
```
myapp.local
```

### 2. 多个域名 - 空格分隔
```
api.local web.local admin.local
```

### 3. 多个域名 - 逗号分隔
```
app1.com,app2.com,app3.com
```

### 4. 多个域名 - 分号分隔
```
api.example.com;web.example.com;admin.example.com
```

### 5. 混合分隔符
```
app1.com; app2.net    app3.org,app4.io
```

### 6. 复杂混合示例
```
api.local,,,   web.local;;;admin.local    dashboard.local
```

## 系统协作流程

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Unified Core   │───▶│   Shell Script   │───▶│  PHP Laravel    │
│   (Python)      │    │     (Bash)       │    │ ServerManager   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   域名解析输入            传递域名数组              处理每个域名
   设置变量              循环调用PHP              ├─创建nginx配置
   └─DOMAINS            └─端口来自unified        ├─自动SSL检测
   └─DOMAIN_COUNT         管理器实际情况          └─反代到指定端口

固定配置：
- PHP模式: Swoole (固定 - 不可配置)
- SSL: auto (自动检测证书)
- 端口: 由unified_manager根据实际应用传递
- 性能: Swoole提供最佳性能
```

## 用户界面提示

当用户选择 **P** (Create service with proxy) 时，系统显示：

```
Enter domain(s) - Examples:
  Single: myapp.local
  Multiple: api.local,web.local admin.local
  Mixed: app1.com; app2.net app3.org
Domains:
```

## 处理逻辑

1. **输入验证**: 检查输入不为空
2. **域名解析**: 使用正则 `[,;\s]+` 分割
3. **清理处理**: 去除空白字符，过滤空值
4. **结果验证**: 确保至少有一个有效域名
5. **传递给Shell**: 空格分隔的域名字符串
6. **PHP处理**: 逐个域名创建proxy配置

## 重要变更

**⚠️ PHP模式固定为Swoole**
- 移除了 `--php-mode` 参数
- 所有Laravel/PHP网站强制使用Swoole模式
- 不再支持FPM模式切换
- 所有相关命令现在只支持Swoole

## 注意事项

- 支持任意数量的分隔符组合
- 自动去除多余空格
- **Swoole为唯一模式**，提供最佳性能
- 端口由unified_manager根据实际情况自动传递
- SSL证书自动检测和配置
- 所有Laravel/PHP网站均使用Octane+Swoole架构