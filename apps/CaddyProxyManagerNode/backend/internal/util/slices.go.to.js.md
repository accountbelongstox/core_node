# internal/util/slices.go

## 1. 功能描述
提供切片操作的通用工具函数，包括切片的转换、过滤、映射等操作的实用函数。

## 2. API接口清单
不直接提供API接口，为应用程序提供切片处理工具。

## 3. 方法清单
- `Map[T, U any](slice []T, fn func(T) U) []U`: 切片映射
- `Filter[T any](slice []T, fn func(T) bool) []T`: 切片过滤
- `Contains[T comparable](slice []T, item T) bool`: 检查切片包含
- `Unique[T comparable](slice []T) []T`: 去除重复元素
- `Chunk[T any](slice []T, size int) [][]T`: 切片分块

## 4. 文件调用关系
调用的其他文件：
- internal/errors/errors.go (错误处理) 