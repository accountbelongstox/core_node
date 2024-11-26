# internal/jobqueue/main.go

## 1. 功能描述
实现后台任务队列系统，处理异步任务的调度和执行。

## 2. API接口清单
不直接提供API接口，为应用程序提供任务队列支持。

## 3. 方法清单
- `NewJobQueue(config *config.Config) *JobQueue`: 创建任务队列实例
- `AddJob(job *Job) error`: 添加新任务
- `Start() error`: 启动任务队列
- `Stop() error`: 停止任务队列
- `ProcessJob(job *Job) error`: 处理单个任务

## 4. 文件调用关系
调用的其他文件：
- internal/config/config.go (配置管理)
- internal/jobqueue/models.go (任务模型)
- internal/jobqueue/worker.go (工作器)
- internal/logger/logger.go (日志处理)
- internal/errors/errors.go (错误处理) 