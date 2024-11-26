# internal/database/models.go

## 1. 功能描述
定义应用程序的数据库模型结构，包括用户、主机配置等核心数据模型的定义和关联关系。

## 2. API接口清单
不直接提供API接口，为数据库操作提供模型定义。

## 3. 方法清单
- `User struct`: 用户模型定义及其方法
  - `BeforeCreate() error`: 创建前钩子
  - `ValidatePassword(password string) bool`: 密码验证
- `Host struct`: 主机配置模型定义及其方法
  - `Validate() error`: 验证主机配置
  - `BeforeSave() error`: 保存前钩子
- `Migration() error`: 数据库迁移方法

## 4. 文件调用关系
调用的其他文件：
- internal/auth/auth.go (密码处理)
- internal/errors/errors.go (错误处理)
- internal/util/interfaces.go (接口定义) 