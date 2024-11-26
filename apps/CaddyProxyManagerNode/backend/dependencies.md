
## 依赖包说明

### 核心依赖
- `express`: Web 应用框架
- `sequelize`: ORM 数据库工具
- `sqlite3`: SQLite 数据库驱动
- `bcrypt`: 密码加密
- `jsonwebtoken`: JWT 认证
- `handlebars`: 模板引擎
- `chalk`: 控制台颜色输出

### 开发依赖
- `nodemon`: 开发环境自动重启
- `jest`: 测试框架

## 注意事项

1. 项目使用 ES Modules，因此在 package.json 中设置了 `"type": "module"`

2. 需要 Node.js 版本 >= 14.0.0

3. 建议使用 yarn 而不是 npm 来安装依赖，以确保版本一致性

4. 如果在安装 bcrypt 或 sqlite3 时遇到编译问题，可能需要安装对应的系统级依赖：
   ```bash
   # Ubuntu/Debian
   sudo apt-get install python build-essential
   
   # CentOS/RHEL
   sudo yum install python make gcc gcc-c++
   ```