# DictV1 全局路径配置分析 — 总结文档 [sx4gh7]

对用户提供的 `<content>`（DictV1 全局路径配置分析）的简明总结。

## 结构
全局静态文件存储路径分析（externalDataPath、external_data 目录树、getFileUrl、URL 模式）→ Laravel 全局数据库分析（deploy.sh、laravel_db、.env、DictV1 专用库）→ 路径配置总结（4 点）→ 设计优势（目录分离、多级存储、URL 映射）→ 配置建议（生产/开发 .env）。

## 要点
- **外部存储**：根路径 env('DICT_EXTERNAL_DATA_PATH', storage_path('app/external_data'))；含 databases/（word_main.db、cache_translate.db、legacy_data.db）、audio/、images/、cache/、markers/。
- **URL**：getFileUrl 生成 url('/storage/external' + 相对路径)；访问模式 http://domain.com/storage/external/{相对路径}。
- **Laravel DB**：/www/wwwroot/laravel_main/laravel_db/database.sqlite；.env 中 DB_CONNECTION=sqlite、DB_DATABASE=路径。
- **文件查找**：音频/图片支持多扩展名（mp3/wav/ogg；jpg/png/gif/webp 等）。
- **设计**：代码与数据分离、框架级与应用级数据库分离、静态文件外部化、统一 URL 映射。

## 用途
说明 DictV1 与 Laravel 的路径与存储设计，支持从 Node.js 到 Laravel 的迁移与生产/开发环境配置。
