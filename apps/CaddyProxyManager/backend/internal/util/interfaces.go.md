# internal/util/interfaces.go

## 1. 功能描述
定义应用程序中使用的通用接口，提供跨模块的标准接口定义，促进模块间的解耦和标准化。

## 2. API接口清单
不直接提供API接口，为应用程序提供接口定义。

## 3. 方法清单
- `Validator interface`: 数据验证接口
  - `Validate() error`
- `Identifiable interface`: 可识别对象接口
  - `GetID() uint`
- `Serializable interface`: 可序列化接口
  - `Serialize() ([]byte, error)`
  - `Deserialize(data []byte) error`

## 4. 文件调用关系
调用的其他文件：
- internal/errors/errors.go (错误处理) 