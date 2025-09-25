# Laravel 云码 MCP 服务实现指南

> **重要**: 本项目遵循 polyapp-laravel 聚合应用规范，采用多应用架构模式

> **项目迁移说明**: 本项目原名"寸止 (Cunzhi)"，现已重命名为"云码 (Yunma)"。所有相关的命名空间、类名、配置都已相应更新。

## 项目概述

云码 MCP 服务作为 Laravel 聚合应用中的一个独立应用模块，应用名称为 `YunmaV1`，提供：
- MCP 协议桥接服务
- 设备管理和推送通知
- WebSocket 实时通信
- 健康检查和监控
- 远程编程协作支持

## 1. 应用结构规范

### 1.1 应用命名规范
- **应用名称**: `YunmaV1` (Yunma + V1，原 CunzhiV1)
- **应用版本**: V1 (初始版本)
- **命名空间**: `App\Apps\YunmaV1`

> **迁移说明**: 从 `CunzhiV1` 迁移到 `YunmaV1`，所有类名、文件名、命名空间都需要相应更新

### 1.2 目录结构
```
app/Apps/YunmaV1/
├── YunmaV1Controllers/           # 控制器目录
│   ├── YunmaV1HealthCtl.php     # 健康检查控制器
│   ├── YunmaV1McpCtl.php        # MCP 交互控制器
│   ├── YunmaV1DeviceCtl.php     # 设备管理控制器
│   └── YunmaV1NotificationCtl.php # 通知控制器
├── YunmaV1Models/               # 模型目录
│   ├── YunmaV1McpRequestModel.php
│   ├── YunmaV1DeviceModel.php
│   ├── YunmaV1NotificationModel.php
│   └── YunmaV1McpServerStatusModel.php
├── YunmaV1Utils/                # 应用专属工具类
│   ├── YunmaV1McpUtils.php
│   ├── YunmaV1NotificationUtils.php
│   └── YunmaV1WebSocketUtils.php
├── YunmaV1Gvar/                 # 应用全局变量
│   ├── YunmaV1Constants.php
│   └── YunmaV1Config.php
├── YunmaV1TablesMaps/           # 数据表映射
│   └── YunmaV1TablesMaps.php
└── ApiInfo.php                   # API 信息收集
```

### 1.3 依赖安装

```bash
# 进入 Laravel 项目目录
cd laravel_bridge

# 安装必要的包
composer require pusher/pusher-php-server
composer require laravel/sanctum
composer require beyondcode/laravel-websockets
composer require predis/predis
composer require laravel/horizon
composer require kreait/firebase-php
composer require pusher/push-notifications
```

## 2. 路由配置

### 2.1 路由结构
按照 polyapp-laravel 规范，创建应用专属路由目录：

```
routes/YunmaV1Router/
├── api.php                       # YunmaV1 应用的 API 路由
└── channels.php                  # WebSocket 频道定义
```

> **迁移说明**: 路由目录从 `CunzhiV1Router` 更名为 `YunmaV1Router`

### 2.2 主路由引入
在 `routes/api.php` 中引入 YunmaV1 路由：

```php
<?php
// routes/api.php

// 引入 YunmaV1 应用路由 (原 CunzhiV1Router)
require_once __DIR__ . '/YunmaV1Router/api.php';
```

### 2.3 应用路由定义
**routes/YunmaV1Router/api.php**
```php
<?php

use Illuminate\Support\Facades\Route;
use App\Apps\YunmaV1\YunmaV1Controllers\YunmaV1HealthCtl;
use App\Apps\YunmaV1\YunmaV1Controllers\YunmaV1McpCtl;
use App\Apps\YunmaV1\YunmaV1Controllers\YunmaV1DeviceCtl;
use App\Apps\YunmaV1\YunmaV1Controllers\YunmaV1NotificationCtl;

// YunmaV1 应用路由组 (原 api/cunzhi/v1 更新为 api/yunma/v1)
Route::prefix('api/yunma/v1')->group(function () {

    // 健康检查和探测
    Route::get('/health', [YunmaV1HealthCtl::class, 'health']);
    Route::get('/mcp/status', [YunmaV1HealthCtl::class, 'mcpStatus']);
    Route::get('/clients/status', [YunmaV1HealthCtl::class, 'clientsStatus']);
    Route::post('/mcp/heartbeat', [YunmaV1HealthCtl::class, 'receiveHeartbeat']);

    // MCP 交互
    Route::post('/mcp/popup', [YunmaV1McpCtl::class, 'createPopup']);
    Route::post('/mcp/response', [YunmaV1McpCtl::class, 'submitResponse']);
    Route::get('/mcp/requests', [YunmaV1McpCtl::class, 'getActiveRequests']);
    Route::delete('/mcp/requests/{id}', [YunmaV1McpCtl::class, 'cancelRequest']);
    Route::post('/mcp/batch-response', [YunmaV1McpCtl::class, 'batchResponse']);

    // 设备管理
    Route::get('/devices', [YunmaV1DeviceCtl::class, 'index']);
    Route::post('/devices/sync', [YunmaV1DeviceCtl::class, 'sync']);
    Route::delete('/devices/{id}', [YunmaV1DeviceCtl::class, 'destroy']);

    // 推送通知
    Route::post('/notifications/register-device', [YunmaV1NotificationCtl::class, 'registerDevice']);
    Route::get('/notifications/history', [YunmaV1NotificationCtl::class, 'getHistory']);
    Route::post('/notifications/mark-read', [YunmaV1NotificationCtl::class, 'markAsRead']);

    // API 信息
    Route::get('/api-info', [YunmaV1HealthCtl::class, 'getApiInfo']);
});
```

## 3. 环境配置

### 3.1 应用配置
**app/Apps/YunmaV1/YunmaV1Gvar/YunmaV1Config.php**
```php
<?php

namespace App\Apps\YunmaV1\YunmaV1Gvar;

class YunmaV1Config
{
    // MCP 服务配置
    public const MCP_SERVER_URL = 'http://127.0.0.1:8080';
    public const MCP_HEARTBEAT_INTERVAL = 30;
    public const MCP_REQUEST_TIMEOUT = 300;

    // WebSocket 配置
    public const WEBSOCKET_HOST = '127.0.0.1';
    public const WEBSOCKET_PORT = 6001;

    // 推送通知配置
    public const FCM_SERVER_KEY = 'your_fcm_server_key';
    public const FCM_PROJECT_ID = 'your_project_id';
    public const APNS_CERTIFICATE_PATH = '/path/to/apns.pem';

    // 应用版本信息
    public const APP_VERSION = '1.0.0';
    public const API_VERSION = 'v1';
}
```

### 3.2 应用常量
**app/Apps/YunmaV1/YunmaV1Gvar/YunmaV1Constants.php**
```php
<?php

namespace App\Apps\YunmaV1\YunmaV1Gvar;

class YunmaV1Constants
{
    // MCP 请求状态
    public const MCP_STATUS_PENDING = 'pending';
    public const MCP_STATUS_COMPLETED = 'completed';
    public const MCP_STATUS_CANCELLED = 'cancelled';
    public const MCP_STATUS_TIMEOUT = 'timeout';

    // 设备状态
    public const DEVICE_STATUS_ONLINE = 'online';
    public const DEVICE_STATUS_OFFLINE = 'offline';

    // 通知类型
    public const NOTIFICATION_TYPE_MCP_POPUP = 'mcp_popup';
    public const NOTIFICATION_TYPE_SYSTEM = 'system';
    public const NOTIFICATION_TYPE_CONFIG_UPDATE = 'config_update';

    // 优先级
    public const PRIORITY_NORMAL = 'normal';
    public const PRIORITY_HIGH = 'high';

    // 平台类型
    public const PLATFORM_ANDROID = 'android';
    public const PLATFORM_IOS = 'ios';
}
```

## 4. 数据库设计

### 4.1 数据表映射
**app/Apps/YunmaV1/YunmaV1TablesMaps/YunmaV1TablesMaps.php**
```php
<?php

namespace App\Apps\YunmaV1\YunmaV1TablesMaps;

use App\Providers\GlobalTablesMaps;

class YunmaV1TablesMaps
{
    // 引用全局表映射
    public static function getGlobalTables()
    {
        return GlobalTablesMaps::getTables();
    }

    // YunmaV1 应用专属表映射 (原 CunzhiV1)
    public static function getTables()
    {
        return [
            'mcp_requests' => [
                'tablename' => 'yunmav1_mcp_requests',
                'fields' => [
                    'id' => 'id',
                    'request_id' => 'request_id',
                    'message' => 'message',
                    'predefined_options' => 'predefined_options',
                    'is_markdown' => 'is_markdown',
                    'timeout' => 'timeout',
                    'source' => 'source',
                    'priority' => 'priority',
                    'status' => 'status',
                    'response' => 'response',
                    'response_time' => 'response_time',
                    'client_id' => 'client_id',
                    'expires_at' => 'expires_at',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at'
                ]
            ],
            'devices' => [
                'tablename' => 'yunmav1_devices',
                'fields' => [
                    'id' => 'id',
                    'device_id' => 'device_id',
                    'device_token' => 'device_token',
                    'platform' => 'platform',
                    'app_version' => 'app_version',
                    'device_info' => 'device_info',
                    'status' => 'status',
                    'last_active' => 'last_active',
                    'last_heartbeat' => 'last_heartbeat',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at'
                ]
            ],
            'notifications' => [
                'tablename' => 'yunmav1_notifications',
                'fields' => [
                    'id' => 'id',
                    'notification_id' => 'notification_id',
                    'title' => 'title',
                    'body' => 'body',
                    'type' => 'type',
                    'data' => 'data',
                    'target_devices' => 'target_devices',
                    'priority' => 'priority',
                    'status' => 'status',
                    'sent_at' => 'sent_at',
                    'delivered_at' => 'delivered_at',
                    'read_at' => 'read_at',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at'
                ]
            ],
            'mcp_server_status' => [
                'tablename' => 'yunmav1_mcp_server_status',
                'fields' => [
                    'id' => 'id',
                    'server_id' => 'server_id',
                    'status' => 'status',
                    'last_heartbeat' => 'last_heartbeat',
                    'uptime_seconds' => 'uptime_seconds',
                    'version' => 'version',
                    'active_requests' => 'active_requests',
                    'total_processed' => 'total_processed',
                    'metadata' => 'metadata',
                    'created_at' => 'created_at',
                    'updated_at' => 'updated_at'
                ]
            ]
        ];
    }

    // 获取表名
    public static function getTableName(string $key): string
    {
        $tables = self::getTables();
        return $tables[$key]['tablename'] ?? '';
    }

    // 获取字段名
    public static function getFieldName(string $table, string $field): string
    {
        $tables = self::getTables();
        return $tables[$table]['fields'][$field] ?? '';
    }
}
```

### 4.2 数据库迁移

**database/migrations/2024_01_01_000001_create_yunmav1_mcp_requests_table.php**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Apps\YunmaV1\YunmaV1TablesMaps\YunmaV1TablesMaps;

return new class extends Migration
{
    public function up()
    {
        $tableName = YunmaV1TablesMaps::getTableName('mcp_requests');

        Schema::create($tableName, function (Blueprint $table) {
            $table->id();
            $table->string(YunmaV1TablesMaps::getFieldName('mcp_requests', 'request_id'))->unique();
            $table->text(YunmaV1TablesMaps::getFieldName('mcp_requests', 'message'));
            $table->json(YunmaV1TablesMaps::getFieldName('mcp_requests', 'predefined_options'))->nullable();
            $table->boolean(YunmaV1TablesMaps::getFieldName('mcp_requests', 'is_markdown'))->default(false);
            $table->integer(YunmaV1TablesMaps::getFieldName('mcp_requests', 'timeout'))->default(300);
            $table->string(YunmaV1TablesMaps::getFieldName('mcp_requests', 'source'));
            $table->string(YunmaV1TablesMaps::getFieldName('mcp_requests', 'priority'))->default('normal');
            $table->string(YunmaV1TablesMaps::getFieldName('mcp_requests', 'status'))->default('pending');
            $table->text(YunmaV1TablesMaps::getFieldName('mcp_requests', 'response'))->nullable();
            $table->integer(YunmaV1TablesMaps::getFieldName('mcp_requests', 'response_time'))->nullable();
            $table->string(YunmaV1TablesMaps::getFieldName('mcp_requests', 'client_id'))->nullable();
            $table->timestamp(YunmaV1TablesMaps::getFieldName('mcp_requests', 'expires_at'))->nullable();
            $table->timestamps();

            $table->index([
                YunmaV1TablesMaps::getFieldName('mcp_requests', 'status'),
                YunmaV1TablesMaps::getFieldName('mcp_requests', 'created_at')
            ]);
            $table->index([
                YunmaV1TablesMaps::getFieldName('mcp_requests', 'source'),
                YunmaV1TablesMaps::getFieldName('mcp_requests', 'status')
            ]);
        });
    }

    public function down()
    {
        $tableName = YunmaV1TablesMaps::getTableName('mcp_requests');
        Schema::dropIfExists($tableName);
    }
};
```

**database/migrations/create_devices_table.php**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('devices', function (Blueprint $table) {
            $table->id();
            $table->string('device_id')->unique();
            $table->string('device_token');
            $table->string('platform'); // android, ios
            $table->string('app_version');
            $table->json('device_info')->nullable();
            $table->string('status')->default('online'); // online, offline
            $table->timestamp('last_active')->nullable();
            $table->timestamp('last_heartbeat')->nullable();
            $table->timestamps();

            $table->index(['status', 'last_active']);
            $table->index(['platform', 'status']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('devices');
    }
};
```

**database/migrations/create_notifications_table.php**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('notification_id')->unique();
            $table->string('title');
            $table->text('body');
            $table->string('type'); // mcp_popup, system, config_update
            $table->json('data')->nullable();
            $table->json('target_devices'); // 目标设备ID数组
            $table->string('priority')->default('normal'); // normal, high
            $table->string('status')->default('pending'); // pending, sent, delivered, failed
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['type', 'status']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('notifications');
    }
};
```

**database/migrations/create_mcp_server_status_table.php**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('mcp_server_status', function (Blueprint $table) {
            $table->id();
            $table->string('server_id')->unique();
            $table->string('status'); // healthy, warning, error
            $table->timestamp('last_heartbeat');
            $table->integer('uptime_seconds');
            $table->string('version');
            $table->integer('active_requests');
            $table->bigInteger('total_processed');
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('mcp_server_status');
    }
};
```

**database/migrations/create_app_configs_table.php**
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('app_configs', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value');
            $table->string('category')->default('general'); // general, ui, notification, mcp
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index(['category', 'key']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('app_configs');
    }
};
```

## 5. 应用模型

### 5.1 MCP 请求模型

**app/Apps/YunmaV1/YunmaV1Models/YunmaV1McpRequestModel.php**
```php
<?php

namespace App\Apps\YunmaV1\YunmaV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Carbon\Carbon;
use App\Apps\YunmaV1\YunmaV1TablesMaps\YunmaV1TablesMaps;
use App\Apps\YunmaV1\YunmaV1Gvar\YunmaV1Constants;

class YunmaV1McpRequestModel extends Model
{
    use HasFactory;

    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->table = YunmaV1TablesMaps::getTableName('mcp_requests');
    }

    protected $fillable = [
        'request_id',
        'message',
        'predefined_options',
        'is_markdown',
        'timeout',
        'source',
        'priority',
        'status',
        'response',
        'response_time',
        'client_id',
        'expires_at'
    ];

    protected $casts = [
        'predefined_options' => 'array',
        'is_markdown' => 'boolean',
        'timeout' => 'integer',
        'response_time' => 'integer',
        'expires_at' => 'datetime'
    ];

    public function isPending(): bool
    {
        return $this->status === YunmaV1Constants::MCP_STATUS_PENDING;
    }

    public function isCompleted(): bool
    {
        return $this->status === YunmaV1Constants::MCP_STATUS_COMPLETED;
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function markAsCompleted(string $response, int $responseTime = null, string $clientId = null): void
    {
        $this->update([
            YunmaV1TablesMaps::getFieldName('mcp_requests', 'status') => YunmaV1Constants::MCP_STATUS_COMPLETED,
            YunmaV1TablesMaps::getFieldName('mcp_requests', 'response') => $response,
            YunmaV1TablesMaps::getFieldName('mcp_requests', 'response_time') => $responseTime,
            YunmaV1TablesMaps::getFieldName('mcp_requests', 'client_id') => $clientId
        ]);
    }

    public function markAsCancelled(): void
    {
        $this->update([
            YunmaV1TablesMaps::getFieldName('mcp_requests', 'status') => YunmaV1Constants::MCP_STATUS_CANCELLED
        ]);
    }

    public function markAsTimeout(): void
    {
        $this->update([
            YunmaV1TablesMaps::getFieldName('mcp_requests', 'status') => YunmaV1Constants::MCP_STATUS_TIMEOUT
        ]);
    }

    public function setExpiresAt(): void
    {
        $this->update([
            YunmaV1TablesMaps::getFieldName('mcp_requests', 'expires_at') => Carbon::now()->addSeconds($this->timeout)
        ]);
    }

    // 关联关系
    public function notifications()
    {
        return $this->hasMany(YunmaV1NotificationModel::class, 'data->request_id', 'request_id');
    }
}
```

## 6. 应用控制器

### 6.1 健康检查控制器

**app/Apps/YunmaV1/YunmaV1Controllers/YunmaV1HealthCtl.php**
```php
<?php

namespace App\Apps\YunmaV1\YunmaV1Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Apps\YunmaV1\YunmaV1Utils\YunmaV1McpUtils;
use App\Apps\YunmaV1\YunmaV1Utils\YunmaV1WebSocketUtils;
use App\Apps\YunmaV1\YunmaV1Models\YunmaV1McpServerStatusModel;
use App\Apps\YunmaV1\YunmaV1Gvar\YunmaV1Config;

class YunmaV1HealthCtl extends Controller
{
    public function health(): JsonResponse
    {
        $status = [
            'status' => 'ok',
            'timestamp' => now()->toISOString(),
            'uptime' => $this->getUptime(),
            'version' => YunmaV1Config::APP_VERSION,
            'services' => [
                'database' => $this->checkDatabase(),
                'redis' => $this->checkRedis(),
                'websocket' => $this->checkWebSocket(),
                'queue' => $this->checkQueue(),
            ],
            'metrics' => [
                'active_connections' => $this->getActiveConnections(),
                'active_mcp_requests' => $this->getActiveMcpRequests(),
                'total_processed_today' => $this->getTotalProcessedToday(),
                'error_rate_24h' => $this->getErrorRate24h(),
            ]
        ];

        $overallStatus = $this->determineOverallStatus($status['services']);
        $status['status'] = $overallStatus;

        $httpStatus = $overallStatus === 'ok' ? 200 : 503;

        return response()->json($status, $httpStatus);
    }

    public function mcpStatus(): JsonResponse
    {
        $mcpUtils = new YunmaV1McpUtils();

        return response()->json([
            'connected' => $mcpUtils->isConnected(),
            'last_heartbeat' => $mcpUtils->getLastHeartbeat(),
            'active_requests' => $mcpUtils->getActiveRequestCount(),
            'total_processed' => $mcpUtils->getTotalProcessedCount(),
            'error_count_24h' => $mcpUtils->getErrorCount24h(),
            'average_response_time' => $mcpUtils->getAverageResponseTime(),
        ]);
    }

    public function clientsStatus(): JsonResponse
    {
        $webSocketUtils = new YunmaV1WebSocketUtils();

        return response()->json([
            'total_clients' => $webSocketUtils->getTotalClients(),
            'flutter_clients' => $webSocketUtils->getFlutterClients(),
            'web_clients' => $webSocketUtils->getWebClients(),
            'mcp_server_clients' => $webSocketUtils->getMcpServerClients(),
            'last_activity' => $webSocketUtils->getLastActivity(),
            'client_details' => $webSocketUtils->getClientDetails(),
        ]);
    }

    public function receiveHeartbeat(Request $request): JsonResponse
    {
        $request->validate([
            'status' => 'required|string',
            'timestamp' => 'required|integer',
            'uptime_seconds' => 'required|integer',
            'version' => 'required|string',
            'active_requests' => 'required|integer',
            'total_processed' => 'required|integer',
        ]);

        // 更新 MCP 服务器状态
        YunmaV1McpServerStatusModel::updateOrCreate(
            ['server_id' => 'default'],
            [
                'status' => $request->input('status'),
                'last_heartbeat' => now(),
                'uptime_seconds' => $request->input('uptime_seconds'),
                'version' => $request->input('version'),
                'active_requests' => $request->input('active_requests'),
                'total_processed' => $request->input('total_processed'),
                'metadata' => $request->only([
                    'laravel_connection',
                    'last_heartbeat'
                ])
            ]
        );

        return response()->json([
            'success' => true,
            'next_heartbeat' => YunmaV1Config::MCP_HEARTBEAT_INTERVAL,
            'server_time' => now()->toISOString(),
        ]);
    }

    public function getApiInfo(): JsonResponse
    {
        // 实现 API 信息收集
        $apiInfo = new \App\Apps\YunmaV1\ApiInfo();
        return response()->json($apiInfo->getInfo());
    }

    // 私有辅助方法
    private function checkDatabase(): string
    {
        try {
            \DB::connection()->getPdo();
            return 'ok';
        } catch (\Exception $e) {
            return 'error';
        }
    }

    private function checkRedis(): string
    {
        try {
            \Redis::ping();
            return 'ok';
        } catch (\Exception $e) {
            return 'error';
        }
    }

    private function checkWebSocket(): string
    {
        try {
            $webSocketUtils = new YunmaV1WebSocketUtils();
            return $webSocketUtils->isHealthy() ? 'ok' : 'error';
        } catch (\Exception $e) {
            return 'error';
        }
    }

    private function checkQueue(): string
    {
        try {
            $queueSize = \Queue::size();
            return $queueSize < 1000 ? 'ok' : 'warning';
        } catch (\Exception $e) {
            return 'error';
        }
    }

    private function getUptime(): int
    {
        $startTime = cache('yunma_app_start_time', now()->timestamp);
        return now()->timestamp - $startTime;
    }

    private function getActiveConnections(): int
    {
        $webSocketUtils = new YunmaV1WebSocketUtils();
        return $webSocketUtils->getTotalClients();
    }

    private function getActiveMcpRequests(): int
    {
        $mcpUtils = new YunmaV1McpUtils();
        return $mcpUtils->getActiveRequestCount();
    }

    private function getTotalProcessedToday(): int
    {
        $mcpUtils = new YunmaV1McpUtils();
        return $mcpUtils->getTotalProcessedToday();
    }

    private function getErrorRate24h(): float
    {
        $mcpUtils = new YunmaV1McpUtils();
        return $mcpUtils->getErrorRate24h();
    }

    private function determineOverallStatus(array $services): string
    {
        $hasError = in_array('error', $services);
        $hasWarning = in_array('warning', $services);

        if ($hasError) {
            return 'error';
        } elseif ($hasWarning) {
            return 'warning';
        } else {
            return 'ok';
        }
    }
}
```

### 6.2 设备模型

**app/Apps/CunzhiV1/CunzhiV1Models/CunzhiV1DeviceModel.php**
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Carbon\Carbon;

class Device extends Model
{
    use HasFactory;

    protected $fillable = [
        'device_id',
        'device_token',
        'platform',
        'app_version',
        'device_info',
        'status',
        'last_active',
        'last_heartbeat'
    ];

    protected $casts = [
        'device_info' => 'array',
        'last_active' => 'datetime',
        'last_heartbeat' => 'datetime'
    ];

    public function isOnline(): bool
    {
        return $this->status === 'online' &&
               $this->last_heartbeat &&
               $this->last_heartbeat->diffInMinutes(now()) < 5;
    }

    public function markAsOnline(): void
    {
        $this->update([
            'status' => 'online',
            'last_active' => now(),
            'last_heartbeat' => now()
        ]);
    }

    public function markAsOffline(): void
    {
        $this->update(['status' => 'offline']);
    }

    public function updateHeartbeat(): void
    {
        $this->update([
            'last_heartbeat' => now(),
            'last_active' => now()
        ]);
    }

    // 关联关系
    public function notifications()
    {
        return $this->hasMany(Notification::class, 'target_devices', 'device_id');
    }
}
```

### 3. 通知模型

**app/Models/Notification.php**
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'notification_id',
        'title',
        'body',
        'type',
        'data',
        'target_devices',
        'priority',
        'status',
        'sent_at',
        'delivered_at',
        'read_at'
    ];

    protected $casts = [
        'data' => 'array',
        'target_devices' => 'array',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
        'read_at' => 'datetime'
    ];

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isSent(): bool
    {
        return $this->status === 'sent';
    }

    public function isDelivered(): bool
    {
        return $this->status === 'delivered';
    }

    public function isRead(): bool
    {
        return $this->read_at !== null;
    }

    public function markAsSent(): void
    {
        $this->update([
            'status' => 'sent',
            'sent_at' => now()
        ]);
    }

    public function markAsDelivered(): void
    {
        $this->update([
            'status' => 'delivered',
            'delivered_at' => now()
        ]);
    }

    public function markAsRead(): void
    {
        $this->update(['read_at' => now()]);
    }

    public function markAsFailed(): void
    {
        $this->update(['status' => 'failed']);
    }
}
```

### 4. MCP 服务器状态模型

**app/Models/McpServerStatus.php**
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class McpServerStatus extends Model
{
    use HasFactory;

    protected $table = 'mcp_server_status';

    protected $fillable = [
        'server_id',
        'status',
        'last_heartbeat',
        'uptime_seconds',
        'version',
        'active_requests',
        'total_processed',
        'metadata'
    ];

    protected $casts = [
        'last_heartbeat' => 'datetime',
        'uptime_seconds' => 'integer',
        'active_requests' => 'integer',
        'total_processed' => 'integer',
        'metadata' => 'array'
    ];

    public function isHealthy(): bool
    {
        return $this->status === 'healthy' &&
               $this->last_heartbeat &&
               $this->last_heartbeat->diffInMinutes(now()) < 2;
    }

    public function isOffline(): bool
    {
        return !$this->last_heartbeat ||
               $this->last_heartbeat->diffInMinutes(now()) > 5;
    }
}
```

## 7. API 信息收集

### 7.1 应用 API 信息类

**app/Apps/YunmaV1/ApiInfo.php**
```php
<?php

namespace App\Apps\YunmaV1;

use App\Apps\YunmaV1\YunmaV1Gvar\YunmaV1Config;

class ApiInfo
{
    public function getInfo(): array
    {
        return [
            'app_name' => 'YunmaV1',
            'app_version' => YunmaV1Config::APP_VERSION,
            'api_version' => YunmaV1Config::API_VERSION,
            'supported_headers' => $this->getSupportedHeaders(),
            'apis' => $this->getApis()
        ];
    }

    private function getSupportedHeaders(): array
    {
        return [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
            'Authorization' => 'Bearer {token} (optional for some endpoints)',
            'X-Device-ID' => 'Device identifier for tracking',
            'X-App-Version' => 'Client app version',
            'X-Platform' => 'android|ios'
        ];
    }

    private function getApis(): array
    {
        return [
            // 健康检查和探测
            '/api/yunma/v1/health' => [
                'method' => 'GET',
                'auth_required' => false,
                'feature' => 'System health check with service status',
                'parameters' => [],
                'response_format' => 'HealthStatusResponse'
            ],
            '/api/yunma/v1/mcp/status' => [
                'method' => 'GET',
                'auth_required' => false,
                'feature' => 'MCP service status and metrics',
                'parameters' => [],
                'response_format' => 'McpStatusResponse'
            ],
            '/api/yunma/v1/clients/status' => [
                'method' => 'GET',
                'auth_required' => false,
                'feature' => 'Connected clients status and details',
                'parameters' => [],
                'response_format' => 'ClientStatusResponse'
            ],
            '/api/yunma/v1/mcp/heartbeat' => [
                'method' => 'POST',
                'auth_required' => false,
                'feature' => 'MCP service heartbeat reporting',
                'parameters' => [
                    'status' => 'string (required)',
                    'timestamp' => 'integer (required)',
                    'uptime_seconds' => 'integer (required)',
                    'version' => 'string (required)',
                    'active_requests' => 'integer (required)',
                    'total_processed' => 'integer (required)'
                ],
                'response_format' => 'HeartbeatResponse'
            ],

            // MCP 交互
            '/api/yunma/v1/mcp/popup' => [
                'method' => 'POST',
                'auth_required' => false,
                'feature' => 'Create MCP popup request from Rust service',
                'parameters' => [
                    'id' => 'string (required)',
                    'message' => 'string (required)',
                    'predefined_options' => 'array (optional)',
                    'is_markdown' => 'boolean (optional)',
                    'timeout' => 'integer (optional)',
                    'source' => 'string (required)',
                    'priority' => 'string (optional): normal|high'
                ],
                'response_format' => 'PopupCreatedResponse'
            ],
            '/api/yunma/v1/mcp/response' => [
                'method' => 'POST',
                'auth_required' => false,
                'feature' => 'Submit user response from Flutter app',
                'parameters' => [
                    'request_id' => 'string (required)',
                    'response' => 'any (required)',
                    'response_time' => 'integer (optional)'
                ],
                'response_format' => 'ResponseSubmittedResponse'
            ],
            '/api/yunma/v1/mcp/requests' => [
                'method' => 'GET',
                'auth_required' => false,
                'feature' => 'Get active MCP requests list',
                'parameters' => [
                    'status' => 'string (optional): pending|completed|cancelled|timeout',
                    'limit' => 'integer (optional): default 20'
                ],
                'response_format' => 'ActiveRequestsResponse'
            ],
            '/api/yunma/v1/mcp/requests/{id}' => [
                'method' => 'DELETE',
                'auth_required' => false,
                'feature' => 'Cancel specific MCP request',
                'parameters' => [
                    'id' => 'string (path parameter)'
                ],
                'response_format' => 'RequestCancelledResponse'
            ],
            '/api/yunma/v1/mcp/batch-response' => [
                'method' => 'POST',
                'auth_required' => false,
                'feature' => 'Submit multiple responses in batch',
                'parameters' => [
                    'responses' => 'array (required): [{request_id, response}]'
                ],
                'response_format' => 'BatchResponseResult'
            ],

            // 设备管理
            '/api/yunma/v1/devices' => [
                'method' => 'GET',
                'auth_required' => true,
                'feature' => 'Get user devices list with status',
                'parameters' => [
                    'status' => 'string (optional): online|offline',
                    'platform' => 'string (optional): android|ios'
                ],
                'response_format' => 'DevicesListResponse'
            ],
            '/api/yunma/v1/devices/sync' => [
                'method' => 'POST',
                'auth_required' => true,
                'feature' => 'Sync device state and app data',
                'parameters' => [
                    'device_id' => 'string (required)',
                    'last_sync' => 'string (required): ISO datetime',
                    'app_state' => 'object (required)'
                ],
                'response_format' => 'DeviceSyncResponse'
            ],
            '/api/yunma/v1/devices/{id}' => [
                'method' => 'DELETE',
                'auth_required' => true,
                'feature' => 'Remove device from account',
                'parameters' => [
                    'id' => 'string (path parameter)'
                ],
                'response_format' => 'DeviceRemovedResponse'
            ],

            // 推送通知
            '/api/yunma/v1/notifications/register-device' => [
                'method' => 'POST',
                'auth_required' => false,
                'feature' => 'Register device for push notifications',
                'parameters' => [
                    'device_token' => 'string (required)',
                    'platform' => 'string (required): android|ios',
                    'device_id' => 'string (required)',
                    'app_version' => 'string (required)'
                ],
                'response_format' => 'DeviceRegisteredResponse'
            ],
            '/api/yunma/v1/notifications/history' => [
                'method' => 'GET',
                'auth_required' => true,
                'feature' => 'Get notification history with pagination',
                'parameters' => [
                    'page' => 'integer (optional): default 1',
                    'limit' => 'integer (optional): default 20',
                    'type' => 'string (optional): mcp_popup|system|config_update'
                ],
                'response_format' => 'NotificationHistoryResponse'
            ],
            '/api/yunma/v1/notifications/mark-read' => [
                'method' => 'POST',
                'auth_required' => true,
                'feature' => 'Mark notifications as read',
                'parameters' => [
                    'notification_ids' => 'array (required): string[]'
                ],
                'response_format' => 'NotificationsMarkedResponse'
            ],

            // API 信息
            '/api/yunma/v1/api-info' => [
                'method' => 'GET',
                'auth_required' => false,
                'feature' => 'Get this API information and documentation',
                'parameters' => [],
                'response_format' => 'ApiInfoResponse'
            ]
        ];
    }
}
```

## 8. 应用工具类

### 8.1 MCP 工具类

**app/Apps/YunmaV1/YunmaV1Utils/YunmaV1McpUtils.php**
    {
        $config = static::where('key', $key)->first();
        return $config ? $config->value : $default;
    }

    public static function set(string $key, $value): void
    {
        static::updateOrCreate(
            ['key' => $key],
            ['value' => $value]
        );
    }

    public static function getUiConfig(): array
    {
        return static::get('ui_config', [
            'theme' => 'light',
            'always_on_top' => false,
            'window_config' => [
                'fixed' => true,
                'fixed_width' => 600,
                'fixed_height' => 800,
                'free_width' => 600,
                'free_height' => 800
            ],
            'audio_notification' => true,
            'audio_url' => null
        ]);
    }

    public static function getAudioConfig(): array
    {
        return static::get('audio_config', [
            'notification_enabled' => true,
            'custom_url' => 'default'
        ]);
    }

    public static function getReplyConfig(): array
    {
        return static::get('reply_config', [
            'default_reply' => '',
            'quick_replies' => [],
            'auto_reply_enabled' => false
        ]);
    }

    public static function getCustomPromptConfig(): array
    {
        return static::get('custom_prompt_config', [
            'enabled' => true,
            'max_prompts' => 50,
            'prompts' => []
        ]);
    }

    public static function getShortcutConfig(): array
    {
        return static::get('shortcut_config', [
            'shortcuts' => []
        ]);
    }

    public static function getTelegramConfig(): array
    {
        return static::get('telegram_config', [
            'enabled' => false,
            'bot_token' => null,
            'chat_id' => null,
            'hide_frontend_popup' => false
        ]);
    }
}
```

## 服务类

### 1. MCP 服务

**app/Services/McpService.php**
```php
<?php

namespace App\Services;

use App\Models\McpRequest;
use App\Events\McpPopupEvent;
use Illuminate\Support\Str;

class McpService
{
    public function createPopupRequest(array $data): McpRequest
    {
        $request = McpRequest::create([
            'request_id' => $data['id'] ?? Str::uuid(),
            'message' => $data['message'],
            'predefined_options' => $data['predefined_options'] ?? null,
            'is_markdown' => $data['is_markdown'] ?? false,
            'timeout' => $data['timeout'] ?? 300,
            'source' => $data['source'],
            'status' => 'pending'
        ]);

        // 广播到前端
        broadcast(new McpPopupEvent($request));

        return $request;
    }

    public function respondToRequest(string $requestId, string $response): bool
    {
        $request = McpRequest::where('request_id', $requestId)
            ->where('status', 'pending')
            ->first();

        if (!$request) {
            return false;
        }

        $request->markAsCompleted($response);
        return true;
    }

    public function cancelRequest(string $requestId): bool
    {
        $request = McpRequest::where('request_id', $requestId)
            ->where('status', 'pending')
            ->first();

        if (!$request) {
            return false;
        }

        $request->markAsCancelled();
        return true;
    }

    public function getActiveRequests(): array
    {
        return McpRequest::where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->get()
            ->toArray();
    }

    public function cleanupExpiredRequests(): int
    {
        $expiredRequests = McpRequest::where('status', 'pending')
            ->where('created_at', '<', now()->subMinutes(10))
            ->get();

        foreach ($expiredRequests as $request) {
            $request->markAsTimeout();
        }

        return $expiredRequests->count();
    }
}
```

### 2. 配置服务

**app/Services/ConfigService.php**
```php
<?php

namespace App\Services;

use App\Models\AppConfig;
use App\Events\ConfigChangedEvent;

class ConfigService
{
    public function getFullConfig(): array
    {
        return [
            'ui_config' => AppConfig::getUiConfig(),
            'audio_config' => AppConfig::getAudioConfig(),
            'reply_config' => AppConfig::getReplyConfig(),
            'custom_prompt_config' => AppConfig::getCustomPromptConfig(),
            'shortcut_config' => AppConfig::getShortcutConfig(),
            'telegram_config' => AppConfig::getTelegramConfig()
        ];
    }

    public function updateConfig(string $section, array $data): void
    {
        AppConfig::set($section, $data);
        
        // 广播配置更新事件
        broadcast(new ConfigChangedEvent($this->getFullConfig()));
    }

    public function updateUiConfig(array $data): void
    {
        $current = AppConfig::getUiConfig();
        $updated = array_merge($current, $data);
        $this->updateConfig('ui_config', $updated);
    }

    public function updateAudioConfig(array $data): void
    {
        $current = AppConfig::getAudioConfig();
        $updated = array_merge($current, $data);
        $this->updateConfig('audio_config', $updated);
    }

    public function updateReplyConfig(array $data): void
    {
        $this->updateConfig('reply_config', $data);
    }

    public function updateCustomPromptConfig(array $data): void
    {
        $this->updateConfig('custom_prompt_config', $data);
    }

    public function updateShortcutConfig(array $data): void
    {
        $this->updateConfig('shortcut_config', $data);
    }

    public function updateTelegramConfig(array $data): void
    {
        $this->updateConfig('telegram_config', $data);
    }
}
```

## 事件类

### 1. MCP 弹窗事件

**app/Events/McpPopupEvent.php**
```php
<?php

namespace App\Events;

use App\Models\McpRequest;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class McpPopupEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $request;

    public function __construct(McpRequest $request)
    {
        $this->request = $request;
    }

    public function broadcastOn()
    {
        return new Channel('mcp-channel');
    }

    public function broadcastAs()
    {
        return 'mcp.popup';
    }

    public function broadcastWith()
    {
        return [
            'id' => $this->request->request_id,
            'message' => $this->request->message,
            'predefined_options' => $this->request->predefined_options,
            'is_markdown' => $this->request->is_markdown,
            'timeout' => $this->request->timeout,
            'source' => $this->request->source
        ];
    }
}
```

### 2. 配置更新事件

**app/Events/ConfigChangedEvent.php**
```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConfigChangedEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $config;

    public function __construct(array $config)
    {
        $this->config = $config;
    }

    public function broadcastOn()
    {
        return new Channel('config-channel');
    }

    public function broadcastAs()
    {
        return 'config.changed';
    }

    public function broadcastWith()
    {
        return $this->config;
    }
}

## 控制器实现

### 1. 基础应用控制器

**app/Http/Controllers/AppController.php**
```php
<?php

namespace App\Http\Controllers;

use App\Services\ConfigService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AppController extends Controller
{
    protected $configService;

    public function __construct(ConfigService $configService)
    {
        $this->configService = $configService;
    }

    public function getInfo(): JsonResponse
    {
        return response()->json([
            'version' => '寸止 v' . config('app.version', '1.0.0')
        ]);
    }

    public function getAlwaysOnTop(): JsonResponse
    {
        $config = $this->configService->getFullConfig();
        return response()->json([
            'enabled' => $config['ui_config']['always_on_top']
        ]);
    }

    public function setAlwaysOnTop(Request $request): JsonResponse
    {
        $request->validate(['enabled' => 'required|boolean']);

        $this->configService->updateUiConfig([
            'always_on_top' => $request->boolean('enabled')
        ]);

        return response()->json(['success' => true]);
    }

    public function syncWindowState(): JsonResponse
    {
        // 在 Laravel 中，这主要是触发前端同步
        broadcast(new \App\Events\WindowSyncEvent());
        return response()->json(['success' => true]);
    }

    public function reloadConfig(): JsonResponse
    {
        // 重新广播当前配置
        $config = $this->configService->getFullConfig();
        broadcast(new \App\Events\ConfigChangedEvent($config));
        return response()->json(['success' => true]);
    }
}
```

### 2. UI 控制器

**app/Http/Controllers/UiController.php**
```php
<?php

namespace App\Http\Controllers;

use App\Services\ConfigService;
use App\Events\ThemeChangedEvent;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class UiController extends Controller
{
    protected $configService;

    public function __construct(ConfigService $configService)
    {
        $this->configService = $configService;
    }

    public function getTheme(): JsonResponse
    {
        $config = $this->configService->getFullConfig();
        return response()->json([
            'theme' => $config['ui_config']['theme']
        ]);
    }

    public function setTheme(Request $request): JsonResponse
    {
        $request->validate([
            'theme' => 'required|in:light,dark'
        ]);

        $this->configService->updateUiConfig([
            'theme' => $request->input('theme')
        ]);

        broadcast(new ThemeChangedEvent($request->input('theme')));

        return response()->json(['success' => true]);
    }

    public function getWindowConfig(): JsonResponse
    {
        $config = $this->configService->getFullConfig();
        return response()->json($config['ui_config']['window_config']);
    }

    public function setWindowConfig(Request $request): JsonResponse
    {
        $request->validate([
            'fixed' => 'boolean',
            'fixed_width' => 'numeric|min:300',
            'fixed_height' => 'numeric|min:200',
            'free_width' => 'numeric|min:300',
            'free_height' => 'numeric|min:200'
        ]);

        $this->configService->updateUiConfig([
            'window_config' => $request->only([
                'fixed', 'fixed_width', 'fixed_height',
                'free_width', 'free_height'
            ])
        ]);

        return response()->json(['success' => true]);
    }

    public function getReplyConfig(): JsonResponse
    {
        $config = $this->configService->getFullConfig();
        return response()->json($config['reply_config']);
    }

    public function setReplyConfig(Request $request): JsonResponse
    {
        $request->validate([
            'default_reply' => 'string',
            'quick_replies' => 'array',
            'quick_replies.*' => 'string',
            'auto_reply_enabled' => 'boolean'
        ]);

        $this->configService->updateReplyConfig($request->all());
        return response()->json(['success' => true]);
    }
}
```

### 3. MCP 控制器

**app/Http/Controllers/McpController.php**
```php
<?php

namespace App\Http\Controllers;

use App\Services\McpService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class McpController extends Controller
{
    protected $mcpService;

    public function __construct(McpService $mcpService)
    {
        $this->mcpService = $mcpService;
    }

    public function createPopup(Request $request): JsonResponse
    {
        $request->validate([
            'id' => 'required|string',
            'message' => 'required|string',
            'predefined_options' => 'nullable|array',
            'predefined_options.*' => 'string',
            'is_markdown' => 'nullable|boolean',
            'timeout' => 'nullable|integer|min:1',
            'source' => 'required|string'
        ]);

        $mcpRequest = $this->mcpService->createPopupRequest($request->all());

        // 等待响应 (使用轮询或 WebSocket)
        $response = $this->waitForResponse($mcpRequest->request_id, $request->input('timeout', 300));

        return response()->json(['response' => $response]);
    }

    public function submitResponse(Request $request): JsonResponse
    {
        $request->validate([
            'request_id' => 'required|string',
            'response' => 'required'
        ]);

        $success = $this->mcpService->respondToRequest(
            $request->input('request_id'),
            $request->input('response')
        );

        return response()->json(['success' => $success]);
    }

    public function getActiveRequests(): JsonResponse
    {
        $requests = $this->mcpService->getActiveRequests();
        return response()->json(['requests' => $requests]);
    }

    public function cancelRequest(string $requestId): JsonResponse
    {
        $success = $this->mcpService->cancelRequest($requestId);
        return response()->json(['success' => $success]);
    }

    private function waitForResponse(string $requestId, int $timeout): string
    {
        $startTime = time();

        while (time() - $startTime < $timeout) {
            $request = \App\Models\McpRequest::where('request_id', $requestId)->first();

            if ($request && $request->isCompleted()) {
                return $request->response;
            }

            if ($request && $request->status !== 'pending') {
                return $request->status; // cancelled, timeout, etc.
            }

            sleep(1); // 等待1秒后重试
        }

        // 超时处理
        $this->mcpService->cancelRequest($requestId);
        return 'TIMEOUT';
    }
}
```

## 路由配置

**routes/api.php**
```php
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AppController;
use App\Http\Controllers\UiController;
use App\Http\Controllers\McpController;
use App\Http\Controllers\AudioController;
use App\Http\Controllers\PromptController;
use App\Http\Controllers\ShortcutController;
use App\Http\Controllers\TelegramController;
use App\Http\Controllers\SystemController;

// 基础应用 API
Route::prefix('app')->group(function () {
    Route::get('info', [AppController::class, 'getInfo']);
    Route::get('always-on-top', [AppController::class, 'getAlwaysOnTop']);
    Route::post('always-on-top', [AppController::class, 'setAlwaysOnTop']);
    Route::post('sync-window-state', [AppController::class, 'syncWindowState']);
    Route::post('reload-config', [AppController::class, 'reloadConfig']);
});

// UI 配置 API
Route::prefix('ui')->group(function () {
    Route::get('theme', [UiController::class, 'getTheme']);
    Route::post('theme', [UiController::class, 'setTheme']);
    Route::get('window-config', [UiController::class, 'getWindowConfig']);
    Route::post('window-config', [UiController::class, 'setWindowConfig']);
    Route::get('reply-config', [UiController::class, 'getReplyConfig']);
    Route::post('reply-config', [UiController::class, 'setReplyConfig']);
});

// MCP 交互 API
Route::prefix('mcp')->group(function () {
    Route::post('popup', [McpController::class, 'createPopup']);
    Route::post('response', [McpController::class, 'submitResponse']);
    Route::get('requests', [McpController::class, 'getActiveRequests']);
    Route::delete('requests/{id}', [McpController::class, 'cancelRequest']);
});

// 音频 API
Route::prefix('audio')->group(function () {
    Route::get('notification-enabled', [AudioController::class, 'getNotificationEnabled']);
    Route::post('notification-enabled', [AudioController::class, 'setNotificationEnabled']);
    Route::get('url', [AudioController::class, 'getUrl']);
    Route::post('url', [AudioController::class, 'setUrl']);
    Route::post('play-notification', [AudioController::class, 'playNotification']);
    Route::post('test', [AudioController::class, 'test']);
    Route::post('stop', [AudioController::class, 'stop']);
});

// 自定义 Prompt API
Route::prefix('prompts')->group(function () {
    Route::get('config', [PromptController::class, 'getConfig']);
    Route::post('/', [PromptController::class, 'create']);
    Route::put('{id}', [PromptController::class, 'update']);
    Route::delete('{id}', [PromptController::class, 'delete']);
    Route::post('enabled', [PromptController::class, 'setEnabled']);
    Route::post('reorder', [PromptController::class, 'reorder']);
});

// 快捷键 API
Route::prefix('shortcuts')->group(function () {
    Route::get('config', [ShortcutController::class, 'getConfig']);
    Route::post('{id}', [ShortcutController::class, 'updateBinding']);
    Route::post('reset', [ShortcutController::class, 'reset']);
});

// Telegram API
Route::prefix('telegram')->group(function () {
    Route::get('config', [TelegramController::class, 'getConfig']);
    Route::post('config', [TelegramController::class, 'setConfig']);
    Route::post('test-connection', [TelegramController::class, 'testConnection']);
});

// 系统控制 API
Route::prefix('system')->group(function () {
    Route::post('open-url', [SystemController::class, 'openUrl']);
    Route::post('exit', [SystemController::class, 'exit']);
});
```

## WebSocket 频道配置

**routes/channels.php**
```php
<?php

use Illuminate\Support\Facades\Broadcast;

// MCP 频道 - 公开频道，所有客户端都可以监听
Broadcast::channel('mcp-channel', function () {
    return true;
});

// 配置更新频道 - 公开频道
Broadcast::channel('config-channel', function () {
    return true;
});

// 系统通知频道 - 公开频道
Broadcast::channel('notification-channel', function () {
    return true;
});
```
```
