# internal/jobqueue/models.go

## 1. 功能描述
定义任务队列相关的数据模型，包括任务定义、状态和结果等结构。

## 2. API接口清单
不直接提供API接口，为任务队列系统提供数据模型支持。

## 3. 方法清单
- `Job struct`: 任务模型定义及其方法
  - `SetStatus(status JobStatus) error`: 设置任务状态
  - `SetResult(result interface{}) error`: 设置任务结果
  - `IsComplete() bool`: 检查任务是否完成
- `JobStatus string`: 任务状态枚举
- `JobType string`: 任务类型枚举

## 4. 文件调用关系
调用的其他文件：
- internal/errors/errors.go (错误处理)
- internal/util/interfaces.go (接口定义) 