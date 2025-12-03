# React Native 项目迁移规范文档

> **项目名称**: SafeGuardian (安无忧)
> **版本**: 0.0.1
> **创建日期**: 2025-12-03
> **项目类型**: React Native 移动应用

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [项目结构](#3-项目结构)
4. [核心功能模块](#4-核心功能模块)
5. [状态管理架构](#5-状态管理架构)
6. [导航系统](#6-导航系统)
7. [组件系统](#7-组件系统)
8. [地图功能实现](#8-地图功能实现)
9. [国际化支持](#9-国际化支持)
10. [主题系统](#10-主题系统)
11. [API 服务层](#11-api-服务层)
12. [开发规范](#12-开发规范)
13. [关键迁移点](#13-关键迁移点)

---

## 1. 项目概述

### 1.1 应用简介
SafeGuardian 是一款家庭安全守护应用，提供位置追踪、健康监测、AI 助手、电子围栏等功能。

### 1.2 目标平台
- Android (主要)
- iOS (未来支持)

### 1.3 核心价值
- 家庭成员位置实时追踪
- 健康数据监测与分析
- 紧急求救功能
- AI 智能助手
- 电子围栏告警

---

## 2. 技术栈

### 2.1 核心框架
```json
{
  "react": "19.1.1",
  "react-native": "0.82.1",
  "typescript": "^5.8.3"
}
```

### 2.2 导航
```json
{
  "@react-navigation/native": "^7.1.22",
  "@react-navigation/native-stack": "^7.8.2",
  "@react-navigation/bottom-tabs": "^7.8.8",
  "react-native-screens": "^4.18.0",
  "react-native-safe-area-context": "^5.5.2",
  "react-native-gesture-handler": "^2.20.2"
}
```

### 2.3 UI 组件
```json
{
  "react-native-vector-icons": "^10.3.0",
  "@react-native-vector-icons/feather": "^12.4.0"
}
```

### 2.4 地图方案
- **原方案**: react-native-maps (Google Maps) ❌ 已废弃
- **新方案**: react-native-webview + OpenStreetMap + Leaflet.js ✅ 当前使用

```json
{
  "react-native-webview": "^13.16.0"
}
```

### 2.5 存储
```json
{
  "@react-native-async-storage/async-storage": "^2.2.0"
}
```

### 2.6 位置服务
```json
{
  "@charer/react-native-tencentmap-geolocation": "^1.0.2"
}
```

### 2.7 工具库
```json
{
  "clsx": "2.1.0"
}
```

---

## 3. 项目结构

```
poly_apps/react_init/
├── android/                      # Android 原生代码
│   ├── app/
│   │   ├── build.gradle         # Android 构建配置
│   │   └── src/main/
│   │       └── AndroidManifest.xml
│   └── build.gradle
├── ios/                          # iOS 原生代码 (未来)
├── src/
│   ├── components/              # 共享组件
│   │   ├── HoloCard.tsx        # 全息卡片组件
│   │   └── Shared.tsx          # 共享 UI 组件库
│   ├── config/                  # 配置文件
│   │   ├── constants.ts        # 常量定义
│   │   └── translations.ts     # 国际化翻译
│   ├── navigation/             # 导航配置
│   │   └── index.tsx           # 导航主入口
│   ├── pages/                   # 页面组件
│   │   ├── Login.tsx           # 登录页
│   │   ├── MapHome.tsx         # 地图首页
│   │   ├── AIAssistant.tsx     # AI 助手
│   │   ├── Shop.tsx            # 商城/发现
│   │   ├── Profile.tsx         # 个人中心
│   │   ├── FriendsList.tsx     # 好友列表
│   │   ├── FriendDetail.tsx    # 好友详情
│   │   ├── AddFriend.tsx       # 添加好友
│   │   ├── SendRequest.tsx     # 发送请求
│   │   ├── Chat.tsx            # 聊天页面
│   │   ├── History.tsx         # 历史轨迹
│   │   ├── EditProfile.tsx     # 编辑资料
│   │   ├── Settings.tsx        # 设置
│   │   └── About.tsx           # 关于
│   ├── services/               # 服务层
│   │   ├── api.ts              # API 服务
│   │   └── location.ts         # 位置服务
│   ├── store/                   # 状态管理
│   │   └── index.tsx           # 全局状态
│   ├── styles/                  # 样式文件
│   │   ├── index.ts
│   │   └── theme.ts            # 主题配置
│   └── types/                   # 类型定义
│       ├── index.ts            # 主类型文件
│       └── tencentmap-geolocation.d.ts
├── App.tsx                      # 应用入口
├── index.js                     # 原生入口
├── package.json
└── tsconfig.json
```

---

## 4. 核心功能模块

### 4.1 认证系统
- **页面**: `Login.tsx`
- **功能**: 手机号登录/注册
- **存储**: AsyncStorage 持久化用户信息

### 4.2 地图定位
- **页面**: `MapHome.tsx`
- **技术**: WebView + OpenStreetMap + Leaflet.js
- **功能**:
  - 实时位置显示
  - 好友位置标记
  - 地图交互操作
  - SOS 紧急求救
  - 电子围栏设置

### 4.3 好友管理
- **页面**:
  - `FriendsList.tsx` - 好友列表
  - `FriendDetail.tsx` - 好友详情
  - `AddFriend.tsx` - 添加好友
  - `SendRequest.tsx` - 发送好友请求
- **功能**:
  - 添加/删除好友
  - 设置好友关系
  - 监控开关
  - 健康数据查看
  - 设备使用报告

### 4.4 AI 助手
- **页面**: `AIAssistant.tsx`
- **功能**:
  - 星座运势查询
  - AI 对话助手
  - 智能建议

### 4.5 个人中心
- **页面**:
  - `Profile.tsx` - 个人中心
  - `EditProfile.tsx` - 编辑资料
  - `Settings.tsx` - 设置
  - `About.tsx` - 关于我们
- **功能**:
  - 个人信息管理
  - 主题切换
  - 语言切换
  - 权限管理

### 4.6 聊天系统
- **页面**: `Chat.tsx`
- **功能**: 与好友聊天（模拟）

### 4.7 历史轨迹
- **页面**: `History.tsx`
- **功能**: 查看好友历史位置轨迹

### 4.8 商城/发现
- **页面**: `Shop.tsx`
- **功能**: 周边商品推荐

---

## 5. 状态管理架构

### 5.1 Context + Hooks
使用 React Context API 实现全局状态管理

**文件**: `src/store/index.tsx`

### 5.2 核心状态

```typescript
interface AppState {
  user: User | null;              // 当前用户
  friends: Friend[];              // 好友列表
  theme: ThemeMode;               // 主题模式 ('light' | 'dark')
  language: Language;             // 语言 ('en' | 'zh')
  isAuthenticated: boolean;       // 认证状态
  isInitialized: boolean;         // 初始化完成

  // Actions
  login: (phone: string) => void;
  logout: () => void;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;     // 翻译函数
  updateUser: (data: Partial<User>) => void;
  toggleMonitor: (friendId: string) => void;
}
```

### 5.3 持久化策略
使用 AsyncStorage 持久化以下数据：
- `app_user` - 用户信息
- `app_theme` - 主题设置
- `app_lang` - 语言设置
- `app_friends` - 好友列表

### 5.4 使用方式

```typescript
import { useStore } from '../store';

const MyComponent = () => {
  const { user, theme, t, login, logout } = useStore();

  return (
    <View>
      <Text>{t('app.name')}</Text>
    </View>
  );
};
```

---

## 6. 导航系统

### 6.1 导航架构

**文件**: `src/navigation/index.tsx`

```
NavigationContainer
  └── 未认证
      └── Stack Navigator
          └── Login
  └── 已认证
      └── Stack Navigator
          ├── MainTabs (Bottom Tabs)
          │   ├── MapHome
          │   ├── AIAssistant
          │   ├── Shop
          │   └── Profile
          ├── FriendsList
          ├── FriendDetail
          ├── AddFriend
          ├── SendRequest
          ├── Chat
          ├── History
          ├── EditProfile
          ├── Settings
          └── About
```

### 6.2 底部导航栏
自定义浮动导航栏（`BottomNav` 组件），包含：
- Home (地图首页)
- AI Assist (AI 助手)
- + 按钮 (添加好友)
- Discover (发现/商城)
- Profile (个人中心)

### 6.3 导航守卫
根据 `isAuthenticated` 状态自动切换认证/未认证导航树

---

## 7. 组件系统

### 7.1 共享组件库

**文件**: `src/components/Shared.tsx`

#### 7.1.1 MobileLayout
移动端布局容器，包含背景渐变球和底部导航

```typescript
<MobileLayout showNav={true}>
  {/* 页面内容 */}
</MobileLayout>
```

#### 7.1.2 GlassCard
毛玻璃卡片效果组件

```typescript
<GlassCard style={customStyles} onPress={() => {}}>
  {/* 卡片内容 */}
</GlassCard>
```

#### 7.1.3 Button
主按钮组件，支持多种变体

```typescript
<Button
  variant="primary" | "danger" | "ghost"
  onPress={() => {}}
  disabled={false}
>
  按钮文字
</Button>
```

#### 7.1.4 Input
输入框组件

```typescript
<Input
  value={value}
  onChangeText={setValue}
  placeholder="请输入"
  secureTextEntry={false}
  keyboardType="default"
  editable={true}
  multiline={false}
/>
```

#### 7.1.5 BottomNav
浮动底部导航栏

```typescript
<BottomNav />
```

#### 7.1.6 Header
页面头部组件

```typescript
<Header
  title="页面标题"
  backTo="上级路由"
  action={<CustomActionComponent />}
/>
```

### 7.2 特殊组件

#### 7.2.1 HoloCard
全息卡片组件（未详细实现）

**文件**: `src/components/HoloCard.tsx`

---

## 8. 地图功能实现

### 8.1 技术方案变更

#### ❌ 旧方案 (已废弃)
- **库**: react-native-maps
- **地图**: Google Maps
- **问题**:
  - 需要 Google API Key
  - 需要 Google Play Services
  - 中国大陆不可用

#### ✅ 新方案 (当前使用)
- **库**: react-native-webview
- **地图**: OpenStreetMap (OSM)
- **地图引擎**: Leaflet.js
- **优势**:
  - 完全免费开源
  - 无需 API Key
  - 全球可用

### 8.2 实现细节

**文件**: `src/pages/MapHome.tsx`

#### 8.2.1 核心代码

```typescript
import { WebView } from 'react-native-webview';

const mapHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      body { margin: 0; padding: 0; }
      #map { width: 100%; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var map = L.map('map', {
        zoomControl: false,
        attributionControl: false
      }).setView([${lat}, ${lng}], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      var marker = L.marker([${lat}, ${lng}]).addTo(map);
      marker.bindPopup('${name}');
    </script>
  </body>
  </html>
`;

<WebView
  style={styles.map}
  originWhitelist={['*']}
  source={{ html: mapHtml }}
  javaScriptEnabled={true}
  domStorageEnabled={true}
/>
```

### 8.3 Android 配置

**文件**: `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### 8.4 未来扩展
- 多标记点支持
- 轨迹绘制
- 电子围栏绘制
- 地图与 React Native 通信 (通过 `window.ReactNativeWebView.postMessage`)

---

## 9. 国际化支持

### 9.1 配置文件

**文件**: `src/config/translations.ts`

### 9.2 支持语言
- `en` - English
- `zh` - 简体中文

### 9.3 使用方式

```typescript
const { t, setLanguage } = useStore();

// 获取翻译
const appName = t('app.name'); // "SafeGuardian" 或 "安无忧"

// 切换语言
setLanguage('zh');
```

### 9.4 翻译键结构

```
app.*          - 应用相关
login.*        - 登录相关
tab.*          - 导航标签
home.*         - 首页相关
friend.*       - 好友相关
stats.*        - 统计相关
me.*           - 个人中心
common.*       - 通用文本
settings.*     - 设置相关
perm.*         - 权限相关
shop.*         - 商城相关
```

---

## 10. 主题系统

### 10.1 主题模式
- `light` - 浅色模式
- `dark` - 深色模式

### 10.2 使用方式

```typescript
const { theme, toggleTheme } = useStore();
const isDark = theme === 'dark';

const styles = StyleSheet.create({
  container: {
    backgroundColor: isDark ? '#0f172a' : '#f0f4f8',
  },
  text: {
    color: isDark ? '#f8fafc' : '#1e293b',
  }
});
```

### 10.3 设计系统

#### 浅色模式
- 背景: `#f0f4f8`
- 主文本: `#1e293b`
- 次要文本: `#64748b`
- 卡片背景: `rgba(255, 255, 255, 0.4)`

#### 深色模式
- 背景: `#0f172a`
- 主文本: `#f8fafc`
- 次要文本: `#94a3b8`
- 卡片背景: `rgba(15, 23, 42, 0.6)`

#### 强调色
- 主色: `#3b82f6` (蓝色)
- 成功: `#22c55e` (绿色)
- 危险: `#ef4444` (红色)
- 警告: `#f59e0b` (橙色)
- 信息: `#14b8a6` (青色)
- 次要: `#8b5cf6` (紫色)

---

## 11. API 服务层

### 11.1 服务架构

**文件**: `src/services/api.ts`

```typescript
export class ApiService {
  private static baseUrl = process.env.API_BASE_URL || 'https://api.example.com';

  static async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return await response.json();
  }
}
```

### 11.2 位置服务

**文件**: `src/services/location.ts`

使用腾讯地图定位服务

```typescript
import TencentGeolocation from '@charer/react-native-tencentmap-geolocation';
```

---

## 12. 开发规范

### 12.1 代码规范

#### TypeScript
- 严格类型检查
- 使用接口定义所有数据结构
- 避免使用 `any` 类型

#### 组件规范
```typescript
// ✅ 推荐
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  return <View>{/* ... */}</View>;
};

export default MyComponent;
```

#### 样式规范
```typescript
// ✅ 使用 StyleSheet.create
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

// ❌ 避免内联样式
<View style={{ flex: 1 }} />
```

### 12.2 文件命名
- 组件: PascalCase (例: `MapHome.tsx`)
- 工具/服务: camelCase (例: `api.ts`)
- 常量: UPPER_SNAKE_CASE (例: `API_BASE_URL`)

### 12.3 导入顺序
```typescript
// 1. React 相关
import React from 'react';
import { View, Text } from 'react-native';

// 2. 第三方库
import { useNavigation } from '@react-navigation/native';

// 3. 本地组件
import { GlassCard } from '../components/Shared';

// 4. Store
import { useStore } from '../store';

// 5. 类型
import type { User } from '../types';

// 6. 样式
import styles from './styles';
```

### 12.4 Git 规范

#### Commit 消息格式
```
类型(范围): 简短描述

详细描述（可选）
```

#### 类型
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

#### 示例
```
feat(map): 迁移到 OpenStreetMap

- 移除 react-native-maps 依赖
- 使用 WebView + Leaflet.js 实现地图
- 更新 Android 配置
```

---

## 13. 关键迁移点

### 13.1 地图迁移 ⭐ 重要

#### 变更内容
1. **依赖变更**
   ```diff
   - "react-native-maps": "^1.26.19"
   + "react-native-webview": "^13.16.0"
   ```

2. **代码变更**
   - 文件: `src/pages/MapHome.tsx`
   - 从: `import MapView from 'react-native-maps'`
   - 到: `import { WebView } from 'react-native-webview'`

3. **Android 配置**
   - 移除: Google Play Services Maps
   - 保留: 位置权限和网络权限

#### 迁移步骤
```bash
# 1. 卸载旧依赖
pnpm remove react-native-maps

# 2. 安装新依赖（已包含在 package.json）
pnpm install

# 3. 修改 MapHome.tsx 使用 WebView + OSM

# 4. 清理 Android 构建
cd android && ./gradlew clean && cd ..

# 5. 重启 Metro
pnpm start --reset-cache
```

### 13.2 状态管理迁移

从其他状态管理方案迁移到 Context API：
1. 确保所有组件使用 `useStore()` hook
2. 移除旧的 Redux/MobX 等依赖
3. 更新所有状态访问代码

### 13.3 导航迁移

确保使用 React Navigation v7：
```typescript
import { useNavigation } from '@react-navigation/native';

const navigation = useNavigation();
navigation.navigate('RouteName', { params });
```

### 13.4 样式迁移

统一使用共享组件和设计系统：
- 使用 `GlassCard` 替代普通 `View` 卡片
- 使用 `Button` 组件替代 `TouchableOpacity`
- 使用 `Input` 组件替代原生 `TextInput`

---

## 附录

### A. 类型定义

**文件**: `src/types/index.ts`

```typescript
export type Language = 'en' | 'zh';
export type ThemeMode = 'light' | 'dark';

export interface User {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  signature?: string;
  gender?: 'male' | 'female';
  address?: string;
  birthday?: string;
  email?: string;
  idCard?: string;
}

export interface Friend extends User {
  relation: string;
  daysConnected: number;
  lastActive: string;
  isMonitored: boolean;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  health?: {
    steps: number;
    heartRate: number;
    temp: number;
  };
  device?: {
    network: 'WiFi' | '4G' | '5G';
    unlocks: number;
    usageTime: string;
  };
  chat?: {
    lastMessage: string;
    unreadCount: number;
    lastMessageTime: string;
  };
}

export interface HistoryPoint {
  time: string;
  location: string;
  duration: string;
  lat: number;
  lng: number;
}

export interface ZodiacSign {
  name: string;
  symbol: string;
  dateRange: string;
  element: string;
}

export interface FortuneResponse {
  horoscope: string;
  luckyColor: string;
  luckyNumber: string;
  mood: string;
}
```

### B. 环境要求

```json
{
  "engines": {
    "node": ">=20"
  }
}
```

### C. 脚本命令

```bash
# 开发
pnpm start              # 启动 Metro bundler
pnpm android            # 运行 Android
pnpm ios                # 运行 iOS

# 代码检查
pnpm lint               # ESLint 检查
pnpm test               # 运行测试
```

### D. 常见问题

#### Q1: 地图不显示怎么办？
A: 检查：
1. WebView 组件是否正确导入
2. `javaScriptEnabled={true}` 是否设置
3. 网络权限是否授予
4. HTML 字符串是否正确拼接

#### Q2: 如何添加新的翻译？
A: 在 `src/config/translations.ts` 中同时添加 `en` 和 `zh` 的翻译项。

#### Q3: 如何自定义主题颜色？
A: 修改 `src/styles/theme.ts` 或在组件中根据 `isDark` 变量动态设置颜色。

---

**文档版本**: 1.0.0
**最后更新**: 2025-12-03
**维护者**: 开发团队
