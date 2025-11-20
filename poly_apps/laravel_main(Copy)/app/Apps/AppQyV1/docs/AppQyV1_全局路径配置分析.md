# DictV1 全局路径配置分析

## 全局静态文件存储路径分析

### 外部存储根目录配置
基于 `DictV1ExternalStorageManager.php` 分析，DictV1采用外部存储架构：

```php
// 外部存储根路径配置
$this->externalDataPath = env('DICT_EXTERNAL_DATA_PATH', storage_path('app/external_data'));
```

### 默认外部存储目录结构

**根目录**: `{Laravel项目}/storage/app/external_data/` (可通过环境变量 `DICT_EXTERNAL_DATA_PATH` 自定义)

```
external_data/
├── databases/                    # 数据库文件目录
│   ├── word_main.db             # 主词典数据库
│   ├── cache_translate.db       # 翻译缓存数据库
│   └── legacy_data.db           # 旧数据迁移数据库
├── audio/                       # 音频文件目录
│   ├── word_sounds/             # 单词语音文件
│   ├── word_subtitles/          # 单词字幕文件
│   ├── sentence_sounds/         # 句子语音文件
│   └── sentence_subtitles/      # 句子字幕文件
├── images/                      # 图像文件目录
│   └── word_images/             # 单词图片文件
├── cache/                       # 缓存目录
│   ├── temp/                    # 临时文件
│   ├── audio_archive.7z         # 音频归档文件
│   └── images_archive.7z        # 图片归档文件
└── markers/                     # 初始化标记文件目录
```

### 静态文件URL映射
```php
// 文件URL生成规则
public function getFileUrl(string $filePath): string
{
    $relativePath = str_replace($this->externalDataPath, '', $filePath);
    return url('/storage/external' . $relativePath);
}
```

**URL访问模式**: `http://domain.com/storage/external/{相对路径}`

---

## Laravel全局数据库目录分析

### 主数据库配置 (SQLite)
基于部署脚本 `deploy.sh` 分析：

```bash
# Laravel项目数据库路径
DB_DIR="/www/wwwroot/laravel_main/laravel_db"
DB_FILE="$DB_DIR/database.sqlite"
```

### 数据库目录结构

**数据库根目录**: `/www/wwwroot/laravel_main/laravel_db/`

```
laravel_db/
└── database.sqlite              # Laravel主数据库文件
```

### 环境变量配置
```bash
# .env 文件中的数据库配置
DB_CONNECTION=sqlite
DB_DATABASE=/www/wwwroot/laravel_main/laravel_db/database.sqlite
```

### DictV1专用数据库配置
DictV1应用使用独立的外部数据库存储：

```
external_data/databases/
├── word_main.db                 # DictV1主要业务数据
├── cache_translate.db           # 翻译缓存数据
└── legacy_data.db               # 从Node.js迁移的旧数据
```

---

## 路径配置总结

### 1. Laravel框架数据库 (系统级)
- **位置**: `/www/wwwroot/laravel_main/laravel_db/database.sqlite`
- **用途**: Laravel框架数据 (sessions, cache, queues等)
- **权限**: 666 (rw-rw-rw-)

### 2. DictV1外部存储 (应用级)
- **位置**: `{Laravel项目}/storage/app/external_data/`
- **可配置**: 通过 `DICT_EXTERNAL_DATA_PATH` 环境变量
- **用途**: DictV1应用专用数据和静态文件
- **权限**: 755 (rwxr-xr-x)

### 3. 静态文件访问
- **内部路径**: `external_data/audio/word_sounds/word.mp3`
- **访问URL**: `http://domain.com/storage/external/audio/word_sounds/word.mp3`
- **映射机制**: Laravel Storage URL生成

### 4. 文件查找机制
```php
// 音频文件查找 (支持多格式)
$extensions = ['mp3', 'wav', 'ogg'];
$filePath = $wordSoundsPath . '/' . $word . '.' . $ext;

// 图片文件查找 (支持多格式)
$extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$pattern = $wordImagesPath . '/' . $word . '*.' . $ext;
```

---

## 设计优势分析

### 1. **目录分离设计**
- ✅ **代码与数据分离**: Laravel代码轻量化
- ✅ **独立备份**: 数据库和静态文件可独立备份
- ✅ **扩展性强**: 支持外部存储配置

### 2. **多级存储架构**
- ✅ **框架级数据库**: Laravel系统数据独立管理
- ✅ **应用级数据库**: DictV1业务数据专用存储
- ✅ **静态文件存储**: 音频、图片文件外部化

### 3. **URL映射机制**
- ✅ **统一访问**: 通过Laravel Storage统一管理
- ✅ **安全访问**: 支持权限控制和缓存
- ✅ **CDN友好**: 易于集成CDN加速

---

## 配置建议

### 生产环境配置
```bash
# .env 配置示例
DICT_EXTERNAL_DATA_PATH=/data/dict_storage
DB_DATABASE=/data/laravel_db/database.sqlite
```

### 开发环境配置
```bash
# .env 配置示例 (默认)
# DICT_EXTERNAL_DATA_PATH 留空使用默认路径
DB_DATABASE=/www/wwwroot/laravel_main/laravel_db/database.sqlite
```

这种路径配置设计确保了系统的可扩展性、可维护性和数据安全性，完美支持了从Node.js VoiceClientAndCaddy到Laravel DictV1的架构迁移需求。