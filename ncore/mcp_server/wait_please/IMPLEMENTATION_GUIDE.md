# 寸止 MCP 服务实现指南

## 项目结构创建

### 1. 创建 Node.js 中间层

```bash
# 在项目根目录下创建 Node.js 项目
mkdir src/node_bridge
cd src/node_bridge

# 初始化项目
npm init -y

# 安装核心依赖
npm install express socket.io cors helmet morgan uuid
npm install axios ws jsonwebtoken bcryptjs

# 安装开发依赖
npm install -D @types/node @types/express @types/cors @types/morgan
npm install -D @types/uuid @types/jsonwebtoken @types/bcryptjs
npm install -D typescript ts-node nodemon jest @types/jest supertest
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier eslint-config-prettier eslint-plugin-prettier

# 创建 TypeScript 配置
npx tsc --init
```

### 2. Node.js 项目配置文件

**package.json**
```json
{
  "name": "cunzhi-node-bridge",
  "version": "1.0.0",
  "description": "Node.js bridge service for Cunzhi MCP",
  "main": "dist/app.js",
  "scripts": {
    "dev": "nodemon src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
  },
  "keywords": ["mcp", "bridge", "websocket", "api"],
  "author": "Cunzhi Team",
  "license": "MIT"
}
```

**tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**nodemon.json**
```json
{
  "watch": ["src"],
  "ext": "ts,json",
  "ignore": ["src/**/*.test.ts"],
  "exec": "ts-node src/app.ts",
  "env": {
    "NODE_ENV": "development"
  }
}
```

### 3. 目录结构创建

```bash
# 创建源码目录结构
mkdir -p src/{routes,services,websocket,types,middleware,utils,config}
mkdir -p src/routes/{app,ui,mcp,prompts,shortcuts,audio}
mkdir -p tests/{unit,integration}
mkdir -p docs

# 创建基础文件
touch src/app.ts
touch src/types/index.ts
touch src/config/index.ts
touch src/services/state.ts
touch src/websocket/index.ts
touch src/routes/index.ts
```

## 核心实现

### 1. 应用入口 (src/app.ts)

```typescript
import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { config } from './config'
import { setupRoutes } from './routes'
import { setupWebSocket } from './websocket'
import { AppState } from './services/state'
import { errorHandler, notFoundHandler } from './middleware/error'
import { logger } from './utils/logger'

const app = express()
const server = createServer(app)

// Socket.IO 配置
const io = new SocketIOServer(server, {
  cors: {
    origin: config.cors.origins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling']
})

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}))

// CORS 配置
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// 基础中间件
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 初始化应用状态
const appState = new AppState()

// 设置路由
setupRoutes(app, appState)

// 设置 WebSocket
setupWebSocket(io, appState)

// 错误处理中间件
app.use(notFoundHandler)
app.use(errorHandler)

// 优雅关闭处理
process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM 信号，开始优雅关闭...')
  server.close(() => {
    logger.info('HTTP 服务器已关闭')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('收到 SIGINT 信号，开始优雅关闭...')
  server.close(() => {
    logger.info('HTTP 服务器已关闭')
    process.exit(0)
  })
})

// 启动服务器
const PORT = config.server.port
server.listen(PORT, () => {
  logger.info(`🚀 Node.js Bridge 服务启动成功`)
  logger.info(`📡 HTTP 服务: http://localhost:${PORT}`)
  logger.info(`🔌 WebSocket 服务: ws://localhost:${PORT}`)
  logger.info(`🌍 环境: ${config.env}`)
})

export { app, server, io }
```

### 2. 配置管理 (src/config/index.ts)

```typescript
import { config as dotenvConfig } from 'dotenv'
import path from 'path'

// 加载环境变量
dotenvConfig()

export const config = {
  env: process.env.NODE_ENV || 'development',
  
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0'
  },
  
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:8080',
      'http://localhost:5173',
      'http://localhost:3000'
    ]
  },
  
  websocket: {
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000', 10),
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '100', 10)
  },
  
  mcp: {
    defaultTimeout: parseInt(process.env.MCP_DEFAULT_TIMEOUT || '300', 10), // 5分钟
    maxConcurrentRequests: parseInt(process.env.MCP_MAX_CONCURRENT || '10', 10)
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || path.join(process.cwd(), 'logs', 'app.log')
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10)
  }
}

// 验证必要的配置
if (config.env === 'production') {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production')
  }
}
```

### 3. 状态管理服务 (src/services/state.ts)

```typescript
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger'
import { 
  AppConfig, 
  PopupRequest, 
  McpRequestState, 
  WebSocketClient,
  BridgeEvent 
} from '../types'

export class AppState extends EventEmitter {
  private config: AppConfig
  private activeRequests: Map<string, McpRequestState> = new Map()
  private connectedClients: Map<string, WebSocketClient> = new Map()
  private requestHistory: PopupRequest[] = []
  private maxHistorySize = 100

  constructor() {
    super()
    this.config = this.getDefaultConfig()
    this.setupCleanupTimer()
  }

  // 配置管理
  getConfig(): AppConfig {
    return JSON.parse(JSON.stringify(this.config))
  }

  updateConfig(updates: Partial<AppConfig>): void {
    const oldConfig = this.getConfig()
    this.config = { ...this.config, ...updates }
    
    logger.info('配置已更新', { updates })
    this.emit('config_changed', this.config, oldConfig)
  }

  // MCP 请求管理
  async addMcpRequest(request: PopupRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      // 检查并发限制
      if (this.activeRequests.size >= 10) {
        reject(new Error('Too many concurrent requests'))
        return
      }

      const timeout = setTimeout(() => {
        this.activeRequests.delete(request.id)
        logger.warn(`MCP 请求超时: ${request.id}`)
        reject(new Error('Request timeout'))
      }, (request.timeout || 300) * 1000)

      const requestState: McpRequestState = {
        request,
        resolve,
        reject,
        timeout,
        createdAt: new Date()
      }

      this.activeRequests.set(request.id, requestState)
      this.addToHistory(request)

      logger.info(`新增 MCP 请求: ${request.id}`, { 
        message: request.message.substring(0, 100),
        source: request.source 
      })

      // 广播到前端
      this.emit('mcp_popup', request)
    })
  }

  resolveMcpRequest(requestId: string, response: string): boolean {
    const requestState = this.activeRequests.get(requestId)
    if (requestState) {
      clearTimeout(requestState.timeout)
      requestState.resolve(response)
      this.activeRequests.delete(requestId)
      
      logger.info(`MCP 请求已响应: ${requestId}`, { 
        response: response.substring(0, 100) 
      })
      return true
    }
    
    logger.warn(`未找到 MCP 请求: ${requestId}`)
    return false
  }

  cancelMcpRequest(requestId: string): boolean {
    const requestState = this.activeRequests.get(requestId)
    if (requestState) {
      clearTimeout(requestState.timeout)
      requestState.resolve('CANCELLED')
      this.activeRequests.delete(requestId)
      
      logger.info(`MCP 请求已取消: ${requestId}`)
      return true
    }
    return false
  }

  getActiveMcpRequests(): PopupRequest[] {
    return Array.from(this.activeRequests.values()).map(state => state.request)
  }

  getRequestHistory(): PopupRequest[] {
    return [...this.requestHistory]
  }

  // 客户端连接管理
  addClient(clientId: string, socket: any, clientType: 'frontend' | 'mcp_server' = 'frontend'): void {
    const client: WebSocketClient = {
      id: clientId,
      socket,
      clientType,
      connectedAt: new Date(),
      lastPing: new Date()
    }
    
    this.connectedClients.set(clientId, client)
    logger.info(`客户端已连接: ${clientId} (${clientType})`)
    
    this.emit('client_connected', client)
  }

  removeClient(clientId: string): void {
    const client = this.connectedClients.get(clientId)
    if (client) {
      this.connectedClients.delete(clientId)
      logger.info(`客户端已断开: ${clientId}`)
      this.emit('client_disconnected', client)
    }
  }

  updateClientPing(clientId: string): void {
    const client = this.connectedClients.get(clientId)
    if (client) {
      client.lastPing = new Date()
    }
  }

  getConnectedClients(): WebSocketClient[] {
    return Array.from(this.connectedClients.values())
  }

  getClientStats() {
    const clients = this.getConnectedClients()
    return {
      total: clients.length,
      frontend: clients.filter(c => c.clientType === 'frontend').length,
      mcp_server: clients.filter(c => c.clientType === 'mcp_server').length,
      active_requests: this.activeRequests.size
    }
  }

  // 广播事件到所有客户端
  broadcast(event: string, data: any, clientType?: 'frontend' | 'mcp_server'): void {
    const clients = clientType 
      ? Array.from(this.connectedClients.values()).filter(c => c.clientType === clientType)
      : Array.from(this.connectedClients.values())

    clients.forEach(client => {
      try {
        client.socket.emit(event, data)
      } catch (error) {
        logger.error(`广播事件失败: ${client.id}`, error)
        this.removeClient(client.id)
      }
    })
  }

  private addToHistory(request: PopupRequest): void {
    this.requestHistory.unshift(request)
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory = this.requestHistory.slice(0, this.maxHistorySize)
    }
  }

  private setupCleanupTimer(): void {
    // 每分钟清理超时的请求
    setInterval(() => {
      const now = new Date()
      const expiredRequests: string[] = []

      this.activeRequests.forEach((state, requestId) => {
        const age = now.getTime() - state.createdAt.getTime()
        if (age > 600000) { // 10分钟超时
          expiredRequests.push(requestId)
        }
      })

      expiredRequests.forEach(requestId => {
        this.cancelMcpRequest(requestId)
      })

      if (expiredRequests.length > 0) {
        logger.info(`清理了 ${expiredRequests.length} 个超时请求`)
      }
    }, 60000)
  }

  private getDefaultConfig(): AppConfig {
    return {
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
        audio_url: undefined
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
      }
    }
  }
}
```

### 4. 类型定义 (src/types/index.ts)

```typescript
import { Socket } from 'socket.io'

// 应用配置类型
export interface AppConfig {
  ui_config: UiConfig
  reply_config: ReplyConfig
  custom_prompt_config: CustomPromptConfig
  shortcut_config: ShortcutConfig
  telegram_config?: TelegramConfig
}

export interface UiConfig {
  theme: 'light' | 'dark'
  always_on_top: boolean
  window_config: WindowConfig
  audio_notification: boolean
  audio_url?: string
}

export interface WindowConfig {
  fixed: boolean
  fixed_width: number
  fixed_height: number
  free_width: number
  free_height: number
}

export interface ReplyConfig {
  default_reply: string
  quick_replies: string[]
  auto_reply_enabled: boolean
}

export interface CustomPromptConfig {
  enabled: boolean
  max_prompts: number
  prompts: CustomPrompt[]
}

export interface CustomPrompt {
  id: string
  name: string
  content: string
  sort_order: number
  enabled: boolean
  is_conditional: boolean
  current_state: boolean
  created_at: string
  updated_at: string
}

export interface ShortcutConfig {
  shortcuts: Record<string, ShortcutBinding>
}

export interface ShortcutBinding {
  key: string
  modifiers: string[]
  enabled: boolean
}

export interface TelegramConfig {
  enabled: boolean
  bot_token?: string
  chat_id?: string
  hide_frontend_popup: boolean
}

// MCP 相关类型
export interface PopupRequest {
  id: string
  message: string
  predefined_options?: string[]
  is_markdown?: boolean
  timeout?: number
  source: string
}

export interface McpRequestState {
  request: PopupRequest
  resolve: (value: string) => void
  reject: (reason: any) => void
  timeout: NodeJS.Timeout
  createdAt: Date
}

export interface ImageAttachment {
  data: string
  mime_type: string
  filename?: string
}

// WebSocket 相关类型
export interface WebSocketClient {
  id: string
  socket: Socket
  clientType: 'frontend' | 'mcp_server'
  connectedAt: Date
  lastPing: Date
}

export interface BridgeEvent {
  type: string
  data: any
  timestamp: Date
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasNext: boolean
  hasPrev: boolean
}

// WebSocket 事件类型
export interface SocketEvent {
  type: string
  data?: any
  timestamp?: number
}

export interface AuthEvent extends SocketEvent {
  type: 'auth'
  token?: string
  client_type: 'frontend' | 'mcp_server'
}

export interface McpResponseEvent extends SocketEvent {
  type: 'mcp_response'
  request_id: string
  response: any
}

export interface ConfigUpdateEvent extends SocketEvent {
  type: 'config_update'
  config: Partial<AppConfig>
}

export interface PingEvent extends SocketEvent {
  type: 'ping'
  timestamp: number
}

export interface PongEvent extends SocketEvent {
  type: 'pong'
  timestamp: number
}
```

## 前端改造指南

### 1. 安装新依赖

```bash
cd src/frontend

# 安装 HTTP 客户端和 WebSocket 客户端
npm install axios socket.io-client

# 安装类型定义
npm install -D @types/socket.io-client
```

### 2. 创建 API 客户端

**src/frontend/src/api/http.ts**
```typescript
import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'

class HttpClient {
  private instance: AxiosInstance

  constructor(baseURL = 'http://localhost:3000') {
    this.instance = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
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

### 3. WebSocket 客户端

**src/frontend/src/api/socket.ts**
```typescript
import { io, Socket } from 'socket.io-client'
import { ref, reactive } from 'vue'

class SocketClient {
  private socket: Socket | null = null
  private eventHandlers: Map<string, Function[]> = new Map()
  
  public isConnected = ref(false)
  public connectionError = ref<string | null>(null)
  public stats = reactive({
    reconnectAttempts: 0,
    lastConnected: null as Date | null,
    lastDisconnected: null as Date | null
  })

  connect(url = 'http://localhost:3000'): void {
    if (this.socket?.connected) {
      return
    }

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    this.setupEventHandlers()
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected.value = false
    }
  }

  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn('Socket not connected, cannot emit:', event)
    }
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

  private setupEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('🔌 Socket 连接成功')
      this.isConnected.value = true
      this.connectionError.value = null
      this.stats.lastConnected = new Date()
      this.stats.reconnectAttempts = 0
      this.emit('socket:connected')
    })

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket 断开连接:', reason)
      this.isConnected.value = false
      this.stats.lastDisconnected = new Date()
      this.emit('socket:disconnected', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Socket 连接错误:', error)
      this.connectionError.value = error.message
      this.stats.reconnectAttempts++
      this.emit('socket:error', error)
    })

    // 业务事件
    this.socket.on('mcp_popup', (data) => {
      this.emit('mcp:popup', data)
    })

    this.socket.on('config_changed', (data) => {
      this.emit('config:changed', data)
    })

    this.socket.on('theme_changed', (data) => {
      this.emit('theme:changed', data)
    })

    this.socket.on('notification', (data) => {
      this.emit('notification', data)
    })

    // 心跳处理
    this.socket.on('pong', (data) => {
      console.log('💓 收到心跳响应')
    })
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

  // 心跳检测
  startHeartbeat(interval = 30000): void {
    setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping', { timestamp: Date.now() })
      }
    }, interval)
  }
}

export const socketClient = new SocketClient()
```

## 部署配置

### 1. Docker 配置

**src/node_bridge/Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制 package 文件
COPY package*.json ./
COPY tsconfig.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源码
COPY src ./src

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 启动应用
CMD ["npm", "start"]
```

**src/frontend/Dockerfile**
```dockerfile
FROM node:18-alpine as builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源码
COPY . .

# 构建应用
RUN npm run build

# 生产环境
FROM nginx:alpine

# 复制构建结果
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
```

### 2. 开发脚本

**scripts/dev-all.sh**
```bash
#!/bin/bash

set -e

echo "🚀 启动寸止完整开发环境..."

# 检查依赖
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 未安装"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "❌ Rust 未安装"; exit 1; }

# 启动 Node.js Bridge
echo "📡 启动 Node.js Bridge..."
cd src/node_bridge
if [ ! -d "node_modules" ]; then
    echo "📦 安装 Node.js 依赖..."
    npm install
fi
npm run dev &
NODE_PID=$!

# 等待 Bridge 启动
echo "⏳ 等待 Node.js Bridge 启动..."
sleep 5

# 检查 Bridge 是否启动成功
if ! curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "❌ Node.js Bridge 启动失败"
    kill $NODE_PID 2>/dev/null
    exit 1
fi

echo "✅ Node.js Bridge 启动成功"

# 启动 Vue 前端
echo "🎨 启动 Vue 前端..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi
npm run dev &
VUE_PID=$!

# 等待前端启动
echo "⏳ 等待前端启动..."
sleep 3

echo "✅ 前端启动成功"

# 显示服务信息
echo ""
echo "🎉 开发环境启动完成!"
echo "📡 Node.js Bridge: http://localhost:3000"
echo "🎨 Vue 前端: http://localhost:8080"
echo "🦀 MCP 服务: 使用 'cargo run -- --mcp-request <file>' 启动"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待中断信号
trap "echo '🛑 停止所有服务...'; kill $NODE_PID $VUE_PID 2>/dev/null; exit" INT TERM

wait
```

这个实现指南提供了完整的项目结构和核心代码实现，可以直接按照步骤进行开发。
