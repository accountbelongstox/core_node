# 寸止系统监控和健康检查指南

## 概述

由于寸止系统采用分布式架构，各组件可能部署在不同的机器上，因此需要完善的监控和健康检查机制来确保系统的可靠性和可用性。

## 架构组件监控

### 1. Rust MCP 服务监控

#### 健康检查端点
```rust
// src/rust/health/mod.rs
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
pub struct HealthStatus {
    pub status: String,
    pub timestamp: u64,
    pub uptime_seconds: u64,
    pub version: String,
    pub laravel_connection: ConnectionStatus,
    pub active_requests: usize,
    pub total_processed: u64,
    pub last_heartbeat: Option<u64>,
}

#[derive(Serialize)]
pub struct ConnectionStatus {
    pub connected: bool,
    pub last_ping: Option<u64>,
    pub response_time_ms: Option<u64>,
    pub error_count: u32,
}

impl HealthStatus {
    pub fn new() -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
            
        Self {
            status: "healthy".to_string(),
            timestamp: now,
            uptime_seconds: get_uptime(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            laravel_connection: check_laravel_connection(),
            active_requests: get_active_request_count(),
            total_processed: get_total_processed_count(),
            last_heartbeat: get_last_heartbeat(),
        }
    }
}
```

#### 心跳机制
```rust
// src/rust/heartbeat/mod.rs
use tokio::time::{interval, Duration};
use reqwest::Client;

pub struct HeartbeatService {
    client: Client,
    laravel_url: String,
    interval_seconds: u64,
}

impl HeartbeatService {
    pub fn new(laravel_url: String) -> Self {
        Self {
            client: Client::new(),
            laravel_url,
            interval_seconds: 30, // 30秒心跳间隔
        }
    }

    pub async fn start(&self) {
        let mut interval = interval(Duration::from_secs(self.interval_seconds));
        
        loop {
            interval.tick().await;
            
            if let Err(e) = self.send_heartbeat().await {
                eprintln!("心跳发送失败: {}", e);
            }
        }
    }

    async fn send_heartbeat(&self) -> Result<(), Box<dyn std::error::Error>> {
        let health_status = HealthStatus::new();
        
        let response = self.client
            .post(&format!("{}/api/mcp/heartbeat", self.laravel_url))
            .json(&health_status)
            .send()
            .await?;

        if response.status().is_success() {
            println!("心跳发送成功");
        } else {
            eprintln!("心跳发送失败: {}", response.status());
        }

        Ok(())
    }
}
```

### 2. Laravel 后端监控

#### 健康检查控制器
```php
<?php
// app/Http/Controllers/HealthController.php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use App\Services\McpService;
use App\Services\WebSocketService;

class HealthController extends Controller
{
    public function health(): JsonResponse
    {
        $status = [
            'status' => 'ok',
            'timestamp' => now()->toISOString(),
            'uptime' => $this->getUptime(),
            'version' => config('app.version', '1.0.0'),
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
        $mcpService = app(McpService::class);
        
        return response()->json([
            'connected' => $mcpService->isConnected(),
            'last_heartbeat' => $mcpService->getLastHeartbeat(),
            'active_requests' => $mcpService->getActiveRequestCount(),
            'total_processed' => $mcpService->getTotalProcessedCount(),
            'error_count_24h' => $mcpService->getErrorCount24h(),
            'average_response_time' => $mcpService->getAverageResponseTime(),
        ]);
    }

    public function clientsStatus(): JsonResponse
    {
        $webSocketService = app(WebSocketService::class);
        
        return response()->json([
            'total_clients' => $webSocketService->getTotalClients(),
            'flutter_clients' => $webSocketService->getFlutterClients(),
            'web_clients' => $webSocketService->getWebClients(),
            'mcp_server_clients' => $webSocketService->getMcpServerClients(),
            'last_activity' => $webSocketService->getLastActivity(),
            'client_details' => $webSocketService->getClientDetails(),
        ]);
    }

    private function checkDatabase(): string
    {
        try {
            DB::connection()->getPdo();
            return 'ok';
        } catch (\Exception $e) {
            return 'error';
        }
    }

    private function checkRedis(): string
    {
        try {
            Redis::ping();
            return 'ok';
        } catch (\Exception $e) {
            return 'error';
        }
    }

    private function checkWebSocket(): string
    {
        // 检查 WebSocket 服务状态
        try {
            $webSocketService = app(WebSocketService::class);
            return $webSocketService->isHealthy() ? 'ok' : 'error';
        } catch (\Exception $e) {
            return 'error';
        }
    }

    private function checkQueue(): string
    {
        try {
            // 检查队列连接和待处理任务数量
            $queueSize = \Illuminate\Support\Facades\Queue::size();
            return $queueSize < 1000 ? 'ok' : 'warning'; // 超过1000个任务时警告
        } catch (\Exception $e) {
            return 'error';
        }
    }

    private function getUptime(): int
    {
        // 获取应用启动时间
        $startTime = cache('app_start_time', now()->timestamp);
        return now()->timestamp - $startTime;
    }

    private function getActiveConnections(): int
    {
        return app(WebSocketService::class)->getTotalClients();
    }

    private function getActiveMcpRequests(): int
    {
        return app(McpService::class)->getActiveRequestCount();
    }

    private function getTotalProcessedToday(): int
    {
        return app(McpService::class)->getTotalProcessedToday();
    }

    private function getErrorRate24h(): float
    {
        return app(McpService::class)->getErrorRate24h();
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

#### MCP 心跳接收
```php
<?php
// app/Http/Controllers/McpHeartbeatController.php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\McpServerStatus;
use App\Events\McpServerHeartbeat;

class McpHeartbeatController extends Controller
{
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
        McpServerStatus::updateOrCreate(
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

        // 广播心跳事件
        broadcast(new McpServerHeartbeat($request->all()));

        return response()->json([
            'success' => true,
            'next_heartbeat' => 30, // 下次心跳间隔（秒）
            'server_time' => now()->toISOString(),
        ]);
    }
}
```

### 3. Flutter 客户端监控

#### 健康检查服务
```dart
// lib/data/services/health_service.dart
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

class HealthService {
  final Dio _dio;
  final String _baseUrl;
  Timer? _healthCheckTimer;
  Timer? _heartbeatTimer;
  
  final StreamController<HealthStatus> _healthController = StreamController.broadcast();
  Stream<HealthStatus> get healthStream => _healthController.stream;

  HealthService(this._dio, this._baseUrl);

  void startHealthChecks() {
    // 每30秒检查一次健康状态
    _healthCheckTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _performHealthCheck(),
    );

    // 每60秒发送一次心跳
    _heartbeatTimer = Timer.periodic(
      const Duration(seconds: 60),
      (_) => _sendHeartbeat(),
    );
  }

  void stopHealthChecks() {
    _healthCheckTimer?.cancel();
    _heartbeatTimer?.cancel();
  }

  Future<void> _performHealthCheck() async {
    try {
      // 检查网络连接
      final connectivity = await Connectivity().checkConnectivity();
      if (connectivity == ConnectivityResult.none) {
        _healthController.add(HealthStatus.offline());
        return;
      }

      // 检查 Laravel 后端
      final response = await _dio.get('/api/health');
      
      if (response.statusCode == 200) {
        final data = response.data;
        _healthController.add(HealthStatus.fromJson(data));
      } else {
        _healthController.add(HealthStatus.degraded('Backend unhealthy'));
      }
    } catch (e) {
      _healthController.add(HealthStatus.error(e.toString()));
    }
  }

  Future<void> _sendHeartbeat() async {
    try {
      final deviceInfo = await _getDeviceInfo();
      
      await _dio.post('/api/clients/heartbeat', data: {
        'client_type': 'flutter_app',
        'device_info': deviceInfo,
        'app_state': await _getAppState(),
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      print('心跳发送失败: $e');
    }
  }

  Future<Map<String, dynamic>> _getDeviceInfo() async {
    // 获取设备信息
    return {
      'platform': 'flutter',
      'version': '1.0.0',
      'device_id': 'unique_device_id',
    };
  }

  Future<Map<String, dynamic>> _getAppState() async {
    // 获取应用状态
    return {
      'active_requests': 0,
      'last_activity': DateTime.now().toIso8601String(),
      'notification_enabled': true,
    };
  }

  void dispose() {
    stopHealthChecks();
    _healthController.close();
  }
}

class HealthStatus {
  final String status;
  final DateTime timestamp;
  final String? message;
  final Map<String, dynamic>? details;

  HealthStatus({
    required this.status,
    required this.timestamp,
    this.message,
    this.details,
  });

  factory HealthStatus.fromJson(Map<String, dynamic> json) {
    return HealthStatus(
      status: json['status'],
      timestamp: DateTime.parse(json['timestamp']),
      details: json,
    );
  }

  factory HealthStatus.offline() {
    return HealthStatus(
      status: 'offline',
      timestamp: DateTime.now(),
      message: 'No network connection',
    );
  }

  factory HealthStatus.degraded(String reason) {
    return HealthStatus(
      status: 'degraded',
      timestamp: DateTime.now(),
      message: reason,
    );
  }

  factory HealthStatus.error(String error) {
    return HealthStatus(
      status: 'error',
      timestamp: DateTime.now(),
      message: error,
    );
  }

  bool get isHealthy => status == 'ok';
  bool get isOffline => status == 'offline';
  bool get hasIssues => status == 'degraded' || status == 'error';
}
```

## 监控指标

### 1. 系统级指标
- **可用性**: 各组件的在线状态
- **响应时间**: API 请求和 WebSocket 消息的响应时间
- **错误率**: 24小时内的错误请求比例
- **连接数**: 活跃的 WebSocket 连接数量

### 2. 业务级指标
- **MCP 请求处理**: 活跃请求数、处理成功率、平均响应时间
- **通知送达率**: 推送通知的成功送达比例
- **用户活跃度**: 活跃设备数、用户交互频率

### 3. 性能指标
- **内存使用**: 各组件的内存占用情况
- **CPU 使用**: 处理器使用率
- **网络延迟**: 组件间通信延迟
- **数据库性能**: 查询响应时间、连接池状态

## 告警机制

### 1. 告警规则
```yaml
# 告警配置示例
alerts:
  - name: "MCP服务离线"
    condition: "mcp_server_status != 'ok'"
    duration: "2m"
    severity: "critical"
    
  - name: "Laravel后端响应慢"
    condition: "api_response_time > 5s"
    duration: "1m"
    severity: "warning"
    
  - name: "Flutter客户端连接异常"
    condition: "flutter_client_count < expected_count * 0.8"
    duration: "5m"
    severity: "warning"
    
  - name: "数据库连接失败"
    condition: "database_status != 'ok'"
    duration: "30s"
    severity: "critical"
```

### 2. 告警通道
- **邮件通知**: 发送给运维团队
- **短信通知**: 紧急情况下的即时通知
- **Slack/钉钉**: 团队协作工具集成
- **系统日志**: 记录所有告警事件

## 故障恢复

### 1. 自动恢复机制
- **服务重启**: 检测到服务异常时自动重启
- **连接重试**: WebSocket 断开时自动重连
- **降级服务**: 部分功能不可用时提供基础服务

### 2. 手动恢复流程
1. **问题识别**: 通过监控系统识别故障组件
2. **影响评估**: 评估故障对用户的影响范围
3. **紧急修复**: 执行紧急修复措施
4. **服务恢复**: 逐步恢复各项服务
5. **事后分析**: 分析故障原因并改进

## 日志管理

### 1. 日志级别
- **DEBUG**: 详细的调试信息
- **INFO**: 一般信息记录
- **WARN**: 警告信息
- **ERROR**: 错误信息
- **FATAL**: 致命错误

### 2. 日志聚合
- **集中收集**: 所有组件日志统一收集
- **结构化存储**: 使用 JSON 格式存储日志
- **索引搜索**: 支持快速搜索和过滤
- **可视化展示**: 通过图表展示日志趋势

这套监控和健康检查机制确保了寸止系统在分布式环境下的可靠运行，能够及时发现和处理各种异常情况。
