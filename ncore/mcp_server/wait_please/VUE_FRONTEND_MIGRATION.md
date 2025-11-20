# Web 管理面板实现指南

> **注意**: 主要用户界面已迁移到 Flutter 移动端。本文档描述可选的 Web 管理面板实现，用于系统管理和监控。

## 项目概述

Web 管理面板是一个可选组件，主要用于：
- 系统状态监控和管理
- 配置管理和调试
- 日志查看和分析
- 开发和测试工具
- MCP 请求历史查看
- 设备管理和通知监控

## 依赖安装

### 1. 创建 Vue 项目

```bash
cd src
npm create vue@latest web_admin
cd web_admin

# 安装必要依赖
npm install axios pusher-js
npm install naive-ui @vueuse/core
npm install -D @types/pusher-js unocss
```

### 2. 更新 package.json

```json
{
  "name": "cunzhi-frontend",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 8080",
    "build": "vue-tsc && vite build",
    "preview": "vite preview --host 0.0.0.0 --port 8080"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "@vueuse/core": "^10.7.0",
    "naive-ui": "^2.38.0",
    "axios": "^1.6.0",
    "pusher-js": "^8.4.0"
  },
  "devDependencies": {
    "@types/pusher-js": "^5.1.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vue-tsc": "^1.8.0",
    "@vitejs/plugin-vue": "^4.5.0",
    "unocss": "^0.58.0"
  }
}
```

## API 客户端实现

### 1. HTTP 客户端

**src/api/http.ts**
```typescript
import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'

class HttpClient {
  private instance: AxiosInstance

  constructor(baseURL = 'http://localhost:8000/api') {
    this.instance = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config) => {
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error: AxiosError) => {
        console.error('❌ Request Error:', error)
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`)
        return response
      },
      (error: AxiosError) => {
        console.error('❌ Response Error:', error.response?.data || error.message)
        return Promise.reject(error)
      }
    )
  }

  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.instance.get<T>(url, { params })
    return response.data
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.instance.post<T>(url, data)
    return response.data
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.instance.put<T>(url, data)
    return response.data
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.instance.delete<T>(url)
    return response.data
  }
}

export const httpClient = new HttpClient()
```

### 2. WebSocket 客户端

**src/api/websocket.ts**
```typescript
import Pusher from 'pusher-js'
import { ref, reactive } from 'vue'

class WebSocketClient {
  private pusher: Pusher | null = null
  private channels: Map<string, any> = new Map()
  private eventHandlers: Map<string, Function[]> = new Map()
  
  public isConnected = ref(false)
  public connectionError = ref<string | null>(null)
  public stats = reactive({
    reconnectAttempts: 0,
    lastConnected: null as Date | null,
    lastDisconnected: null as Date | null
  })

  connect(config = {
    key: 'cunzhi-key',
    cluster: 'mt1',
    wsHost: '127.0.0.1',
    wsPort: 6001,
    forceTLS: false,
    disableStats: true,
    enabledTransports: ['ws', 'wss']
  }): void {
    if (this.pusher?.connection.state === 'connected') {
      return
    }

    this.pusher = new Pusher(config.key, config)

    this.setupEventHandlers()
    this.subscribeToChannels()
  }

  disconnect(): void {
    if (this.pusher) {
      this.pusher.disconnect()
      this.pusher = null
      this.isConnected.value = false
      this.channels.clear()
    }
  }

  private setupEventHandlers(): void {
    if (!this.pusher) return

    this.pusher.connection.bind('connected', () => {
      console.log('🔌 WebSocket 连接成功')
      this.isConnected.value = true
      this.connectionError.value = null
      this.stats.lastConnected = new Date()
      this.stats.reconnectAttempts = 0
      this.emit('websocket:connected')
    })

    this.pusher.connection.bind('disconnected', () => {
      console.log('🔌 WebSocket 断开连接')
      this.isConnected.value = false
      this.stats.lastDisconnected = new Date()
      this.emit('websocket:disconnected')
    })

    this.pusher.connection.bind('error', (error: any) => {
      console.error('🔌 WebSocket 连接错误:', error)
      this.connectionError.value = error.message || 'Connection error'
      this.stats.reconnectAttempts++
      this.emit('websocket:error', error)
    })
  }

  private subscribeToChannels(): void {
    if (!this.pusher) return

    // 订阅 MCP 频道
    const mcpChannel = this.pusher.subscribe('mcp-channel')
    this.channels.set('mcp-channel', mcpChannel)

    mcpChannel.bind('mcp.popup', (data: any) => {
      this.emit('mcp:popup', data)
    })

    // 订阅配置频道
    const configChannel = this.pusher.subscribe('config-channel')
    this.channels.set('config-channel', configChannel)

    configChannel.bind('config.changed', (data: any) => {
      this.emit('config:changed', data)
    })

    configChannel.bind('theme.changed', (data: any) => {
      this.emit('theme:changed', data)
    })

    // 订阅通知频道
    const notificationChannel = this.pusher.subscribe('notification-channel')
    this.channels.set('notification-channel', notificationChannel)

    notificationChannel.bind('notification', (data: any) => {
      this.emit('notification', data)
    })
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`事件处理器错误 [${event}]:`, error)
        }
      })
    }
  }
}

export const websocketClient = new WebSocketClient()
```

## Composables 改造

### 1. API 客户端 Composable

**src/composables/useApiClient.ts**
```typescript
import { ref, onMounted, onUnmounted } from 'vue'
import { httpClient } from '@/api/http'
import { websocketClient } from '@/api/websocket'

export function useApiClient() {
  const isConnected = ref(false)
  const isWebSocketConnected = ref(false)
  const connectionError = ref<string | null>(null)

  const connect = () => {
    try {
      websocketClient.connect()
    } catch (error) {
      connectionError.value = error instanceof Error ? error.message : '连接失败'
    }
  }

  const disconnect = () => {
    websocketClient.disconnect()
  }

  // 事件处理器
  const handleWebSocketConnected = () => {
    isWebSocketConnected.value = true
    connectionError.value = null
  }

  const handleWebSocketDisconnected = () => {
    isWebSocketConnected.value = false
  }

  const handleWebSocketError = (error: any) => {
    connectionError.value = `WebSocket 错误: ${error.message || 'Unknown error'}`
  }

  onMounted(() => {
    websocketClient.on('websocket:connected', handleWebSocketConnected)
    websocketClient.on('websocket:disconnected', handleWebSocketDisconnected)
    websocketClient.on('websocket:error', handleWebSocketError)
    connect()
  })

  onUnmounted(() => {
    websocketClient.off('websocket:connected', handleWebSocketConnected)
    websocketClient.off('websocket:disconnected', handleWebSocketDisconnected)
    websocketClient.off('websocket:error', handleWebSocketError)
    disconnect()
  })

  return {
    isConnected,
    isWebSocketConnected,
    connectionError,
    connect,
    disconnect,
    httpClient,
    websocketClient
  }
}
```

### 2. MCP 处理 Composable

**src/composables/useMcpHandler.ts**
```typescript
import { ref, onMounted, onUnmounted } from 'vue'
import { httpClient } from '@/api/http'
import { websocketClient } from '@/api/websocket'

export function useMcpHandler() {
  const currentRequest = ref<any>(null)
  const isProcessing = ref(false)

  const handleMcpPopup = (data: any) => {
    console.log('收到 MCP 弹窗请求:', data)
    currentRequest.value = data
  }

  const submitResponse = async (response: any) => {
    if (!currentRequest.value) {
      throw new Error('没有活跃的 MCP 请求')
    }

    isProcessing.value = true
    
    try {
      await httpClient.post('/mcp/response', {
        request_id: currentRequest.value.id,
        response: response
      })
      
      currentRequest.value = null
    } finally {
      isProcessing.value = false
    }
  }

  const cancelRequest = async () => {
    if (!currentRequest.value) return

    isProcessing.value = true
    
    try {
      await httpClient.delete(`/mcp/requests/${currentRequest.value.id}`)
      currentRequest.value = null
    } finally {
      isProcessing.value = false
    }
  }

  onMounted(() => {
    websocketClient.on('mcp:popup', handleMcpPopup)
  })

  onUnmounted(() => {
    websocketClient.off('mcp:popup', handleMcpPopup)
  })

  return {
    currentRequest,
    isProcessing,
    submitResponse,
    cancelRequest
  }
}
```

### 3. 配置管理 Composable

**src/composables/useConfig.ts**
```typescript
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { httpClient } from '@/api/http'
import { websocketClient } from '@/api/websocket'

export function useConfig() {
  const config = reactive({
    ui_config: {
      theme: 'light',
      always_on_top: false,
      window_config: {
        fixed: true,
        fixed_width: 600,
        fixed_height: 800,
        free_width: 600,
        free_height: 800
      },
      audio_notification: true,
      audio_url: null
    },
    audio_config: {
      notification_enabled: true,
      custom_url: 'default'
    },
    reply_config: {
      default_reply: '',
      quick_replies: [],
      auto_reply_enabled: false
    },
    custom_prompt_config: {
      enabled: true,
      max_prompts: 50,
      prompts: []
    },
    shortcut_config: {
      shortcuts: {}
    },
    telegram_config: {
      enabled: false,
      bot_token: null,
      chat_id: null,
      hide_frontend_popup: false
    }
  })

  const isLoading = ref(false)

  const loadConfig = async () => {
    isLoading.value = true
    try {
      // 这里需要实现获取完整配置的 API
      const response = await httpClient.get('/app/config')
      Object.assign(config, response)
    } catch (error) {
      console.error('加载配置失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  const updateTheme = async (theme: 'light' | 'dark') => {
    try {
      await httpClient.post('/ui/theme', { theme })
      config.ui_config.theme = theme
    } catch (error) {
      console.error('更新主题失败:', error)
      throw error
    }
  }

  const updateAlwaysOnTop = async (enabled: boolean) => {
    try {
      await httpClient.post('/app/always-on-top', { enabled })
      config.ui_config.always_on_top = enabled
    } catch (error) {
      console.error('更新置顶状态失败:', error)
      throw error
    }
  }

  const handleConfigChanged = (newConfig: any) => {
    console.log('配置已更新:', newConfig)
    Object.assign(config, newConfig)
  }

  const handleThemeChanged = (theme: string) => {
    console.log('主题已更新:', theme)
    config.ui_config.theme = theme
  }

  onMounted(() => {
    websocketClient.on('config:changed', handleConfigChanged)
    websocketClient.on('theme:changed', handleThemeChanged)
    loadConfig()
  })

  onUnmounted(() => {
    websocketClient.off('config:changed', handleConfigChanged)
    websocketClient.off('theme:changed', handleThemeChanged)
  })

  return {
    config,
    isLoading,
    loadConfig,
    updateTheme,
    updateAlwaysOnTop
  }
}
```

## Vite 配置更新

**vite.config.ts**
```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../../dist/frontend',
    emptyOutDir: true,
  },
})
```

## 主应用入口更新

**src/main.ts**
```typescript
import { createApp } from 'vue'
import App from './App.vue'

// 移除 Tauri 相关导入
// import { invoke } from '@tauri-apps/api/core'

const app = createApp(App)

// 移除 Tauri 相关的全局属性
// app.config.globalProperties.$invoke = invoke

app.mount('#app')
```

这个迁移指南提供了将 Vue 前端从 Tauri 桌面应用改造为独立 Web 应用的完整方案，包括依赖更新、API 客户端实现、Composables 改造等。
