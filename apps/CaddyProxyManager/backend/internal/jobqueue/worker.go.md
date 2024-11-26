# internal/jobqueue/worker.go

## 1. 功能描述
实现任务队列的工作器，负责实际执行队列中的任务，包括任务处理、错误处理和状态更新。

## 2. API接口清单
不直接提供API接口，为任务队列系统提供工作器支持。

## 3. 方法清单
- `NewWorker(id int, queue *JobQueue) *Worker`: 创建新的工作器
- `Start()`: 启动工作器
- `Stop()`: 停止工作器
- `ProcessJob(job *Job) error`: 处理单个任务
- `HandleError(job *Job, err error)`: 处理任务错误

## 4. 文件调用关系
调用的其他文件：
- internal/jobqueue/models.go (任务模型)
- internal/jobqueue/main.go (队列管理)
- internal/logger/logger.go (日志处理)
- internal/errors/errors.go (错误处理) 