# 迁移指南：从 holofortune 到 react_init

**文档版本**: 1.0  
**创建日期**: 2025-12-02  
**适用范围**: React Native 项目迁移

---

## 📋 目录

1. [迁移概述](#迁移概述)
2. [架构差异](#架构差异)
3. [样式迁移策略](#样式迁移策略)
4. [依赖包迁移](#依赖包迁移)
5. [页面迁移步骤](#页面迁移步骤)
6. [常见问题](#常见问题)
7. [检查清单](#检查清单)

---

## 🎯 迁移概述

### 迁移原则

本次迁移遵循以下核心原则：

1. **保持页面样式 1:1 复制**：从 `holofortune` 完全复制页面样式、布局、位置等信息
2. **使用最新 React Native 官方规范**：底层实现遵循 React Native 官方最新文档和最佳实践
3. **依赖包现代化**：检查并更新过时的包，使用官方推荐的替代方案

### 项目对比

| 特性 | holofortune (旧项目) | react_init (新项目) |
|------|---------------------|---------------------|
| **样式系统** | CSS 文件 (`style.css`) | StyleSheet (React Native) |
| **状态管理** | React Context + AsyncStorage | React Context + AsyncStorage |
| **导航** | React Navigation | React Navigation (最新版本) |
| **主题系统** | CSS 变量 | TypeScript 主题对象 |
| **颜色处理** | 硬编码颜色值 | 主题化颜色系统（可配置为硬编码以匹配旧项目） |
| **组件结构** | 分散的组件 | 集中化的组件 (`src/components/`) |
| **配置文件** | 分散配置 | 集中化配置 (`src/config/`) |

---

## 🏗️ 架构差异

### 目录结构对比

**holofortune (旧项目)**:
```
holofortune/
├── App.tsx
├── pages/
├── components/
├── store/
├── services/
├── types.ts
├── constants.ts
├── translations.ts
└── style.css
```

**react_init (新项目)**:
```
react_init/
├── App.tsx
├── index.js
├── src/
│   ├── pages/          # 页面组件
│   ├── components/      # 共享组件
│   ├── store/          # 状态管理
│   ├── services/       # API 服务
│   ├── config/         # 配置文件（constants, translations）
│   ├── styles/         # 样式系统（theme, index）
│   └── types/          # TypeScript 类型定义
└── android/
```

### 关键架构变化

1. **配置中心化**：
   - `constants.ts` → `src/config/constants.ts`
   - `translations.ts` → `src/config/translations.ts`

2. **样式系统重构**：
   - `style.css` → `src/styles/theme.ts` + `src/styles/index.ts`
   - CSS 类 → React Native StyleSheet

3. **类型定义集中化**：
   - `types.ts` → `src/types/index.ts`

4. **导航集中化**：
   - `App.tsx` 中的导航配置 → `src/navigation/index.tsx`

---

## 🎨 样式迁移策略

### 原则：1:1 复制页面样式

**重要**：页面样式、布局、位置等信息必须与 `holofortune` 完全一致。

### CSS 到 StyleSheet 转换规则

#### 1. 颜色值处理

**holofortune (CSS)**:
```css
color: #1e293b;
background-color: #3b82f6;
```

**react_init (StyleSheet)**:
```typescript
// 选项 1: 硬编码（与 holofortune 完全一致）
color: '#1e293b',
backgroundColor: '#3b82f6',

// 选项 2: 主题化（推荐，但需确保与 holofortune 视觉效果一致）
color: colors.textPrimary,
backgroundColor: colors.primary,
```

**注意**：为了与 `holofortune` 完全一致，当前项目使用硬编码颜色值。

#### 2. 布局属性转换

| CSS | React Native StyleSheet |
|-----|-------------------------|
| `display: flex` | `flexDirection: 'row'` 或 `'column'` |
| `flex-direction: row` | `flexDirection: 'row'` |
| `align-items: center` | `alignItems: 'center'` |
| `justify-content: space-between` | `justifyContent: 'space-between'` |
| `gap: 12px` | `gap: 12` |
| `padding: 16px` | `padding: 16` |
| `margin-top: 16px` | `marginTop: 16` |
| `border-radius: 12px` | `borderRadius: 12` |
| `position: absolute` | `position: 'absolute'` |
| `z-index: 20` | `zIndex: 20` |

#### 3. 阴影效果转换

**CSS**:
```css
box-shadow: 0 4px 6px rgba(0,0,0,0.1);
```

**React Native**:
```typescript
shadowColor: '#000',
shadowOffset: { width: 0, height: 4 },
shadowOpacity: 0.1,
shadowRadius: 6,
elevation: 4, // Android
```

#### 4. 文本样式转换

**CSS**:
```css
font-size: 16px;
font-weight: 700;
color: #1e293b;
```

**React Native**:
```typescript
fontSize: 16,
fontWeight: '700',
color: '#1e293b',
```

### 样式迁移检查清单

- [ ] 所有颜色值是否与 holofortune 完全一致？
- [ ] 所有间距（padding, margin, gap）是否匹配？
- [ ] 所有圆角（borderRadius）是否一致？
- [ ] 所有阴影效果是否匹配？
- [ ] 所有字体大小和粗细是否一致？
- [ ] 所有布局属性（flex, position）是否正确转换？

---

## 📦 依赖包迁移

### ⚠️ 重要：检查包的状态

在迁移过程中，**必须**到 npm 官网检查每个包的状态：

1. 访问：`https://www.npmjs.com/package/<package-name>`
2. 检查：
   - 是否有弃用（deprecated）警告
   - 是否有推荐的替代包
   - 最新版本和维护状态
   - 是否有安全漏洞

### 依赖包对比表

| 包名 | holofortune | react_init | 状态 | 说明 | npm 检查链接 |
|------|------------|------------|------|------|-------------|
| `react-native` | 0.82.1 | 0.82.1 | ✅ 最新 | 使用最新 React Native 版本 | https://www.npmjs.com/package/react-native |
| `react` | 18.3.1 | 19.1.1 | ✅ 最新 | react_init 使用更新的 React 版本 | https://www.npmjs.com/package/react |
| `@react-navigation/*` | ^7.x | ^7.x | ✅ 最新 | 使用最新 React Navigation | https://www.npmjs.com/package/@react-navigation/native |
| `react-native-maps` | ^1.18.0 | ^1.18.0 | ✅ 正常 | 需配置 API Key（Android/iOS） | https://www.npmjs.com/package/react-native-maps |
| `react-native-vector-icons` | ^10.3.0 | ^12.4.0 | ✅ 正常 | react_init 使用更新的版本，需配置字体文件 | https://www.npmjs.com/package/react-native-vector-icons |
| `@react-native-async-storage/async-storage` | ^2.2.0 | ^2.2.0 | ✅ 正常 | 官方推荐包 | https://www.npmjs.com/package/@react-native-async-storage/async-storage |
| `@react-native-picker/picker` | ^2.11.4 | ^2.11.4 | ✅ 正常 | 官方推荐包 | https://www.npmjs.com/package/@react-native-picker/picker |
| `@charer/react-native-tencentmap-geolocation` | ❌ | ^1.0.2 | ⚠️ **需检查** | 第三方包，**必须检查维护状态** | https://www.npmjs.com/package/@charer/react-native-tencentmap-geolocation |
| `@google/genai` | ^1.30.0 | ❌ | ⚠️ **缺失** | holofortune 使用，react_init 未包含 | https://www.npmjs.com/package/@google/genai |
| `@react-native/new-app-screen` | ❌ | 0.82.1 | ⚠️ **检查** | 可能仅用于开发，需确认是否必需 | https://www.npmjs.com/package/@react-native/new-app-screen |
| `@react-native-vector-icons/feather` | ❌ | ^12.4.0 | ⚠️ **检查** | 检查是否与 `react-native-vector-icons` 重复 | https://www.npmjs.com/package/@react-native-vector-icons/feather |

### 包迁移检查步骤

#### ⚠️ 重要：迁移前必须检查每个包

**在迁移任何页面或功能之前，必须先检查相关依赖包的状态！**

#### 1. 检查每个包的状态

对于 `package.json` 中的每个包，**必须**执行以下检查：

**步骤 A: 访问 npm 官网**
```
1. 打开浏览器
2. 访问：https://www.npmjs.com/package/<package-name>
3. 查看页面顶部是否有红色 "⚠️ This package is deprecated" 警告
4. 查看包描述中是否有弃用说明
5. 查看 "Last publish" 时间（如果超过 1 年，需谨慎）
6. 查看下载量趋势（如果持续下降，可能不再维护）
```

**步骤 B: 使用 npm 命令（辅助检查）**
```bash
# 检查是否被弃用
npm view <package-name> deprecated

# 查看最新版本
npm view <package-name> version

# 查看所有版本
npm view <package-name> versions

# 查看包的详细信息
npm view <package-name>
```

**步骤 C: 检查 GitHub 仓库**
```
1. 在 npm 页面点击 GitHub 链接
2. 检查仓库是否被归档（archived）
3. 查看 Issues 和 Pull Requests 的活跃度
4. 查看是否有迁移指南或 README 说明
```

#### 2. 查找替代方案

如果包被弃用或不再维护：

1. **查看包的 npm 页面**：
   - 检查是否有推荐的替代包（通常在 deprecated 警告中说明）
   - 查看 README 是否有迁移指南

2. **查看包的 GitHub 仓库**：
   - 检查是否有迁移指南（Migration Guide）
   - 查看 Issues 中是否有相关讨论
   - 查看是否有 Fork 版本在维护

3. **搜索社区推荐**：
   - 在 GitHub 上搜索类似功能的包
   - 查看 React Native 官方文档推荐的包
   - 在 Stack Overflow 或 Reddit 上查找替代方案

4. **评估替代方案**：
   - 检查替代包的维护状态
   - 检查替代包的 API 兼容性
   - 检查替代包的文档完整性

#### 3. 更新或替换

根据检查结果采取行动：

- **有替代包**：
  1. 更新 `package.json`，使用推荐的替代包
  2. 更新代码中的导入和使用方式
  3. 充分测试新包的功能

- **无替代包但仍在维护**：
  1. 更新到最新版本
  2. 检查更新日志，了解破坏性变更
  3. 充分测试新版本

- **已弃用且无替代**：
  1. 评估是否可以移除该功能
  2. 考虑自己维护 Fork 版本
  3. 寻找社区维护的替代实现
  4. 评估风险，决定是否继续使用

#### 4. 记录检查结果

建议创建一个检查记录表：

| 包名 | npm 链接 | 状态 | 最后更新 | 替代方案 | 备注 |
|------|----------|------|----------|----------|------|
| `@charer/react-native-tencentmap-geolocation` | [链接](https://www.npmjs.com/package/@charer/react-native-tencentmap-geolocation) | ⚠️ 需检查 | - | - | 第三方包，需仔细检查 |
| ... | ... | ... | ... | ... | ... |

### 包检查示例

以下是一个完整的包检查示例：

#### 示例：检查 `@charer/react-native-tencentmap-geolocation`

**步骤 1: 访问 npm 官网**
```
URL: https://www.npmjs.com/package/@charer/react-native-tencentmap-geolocation
```

**步骤 2: 检查页面信息**
- ✅ 查看页面顶部：是否有 "deprecated" 警告
- ✅ 查看包描述：是否有维护说明
- ✅ 查看 "Last publish"：最后发布时间
- ✅ 查看下载量：每周下载量趋势
- ✅ 查看版本历史：是否有频繁更新

**步骤 3: 检查 GitHub 仓库**
```
1. 点击 npm 页面上的 GitHub 链接
2. 检查仓库状态：
   - 是否被归档（archived）？
   - 最后提交时间？
   - Issues 和 Pull Requests 是否活跃？
3. 查看 README：
   - 是否有维护说明？
   - 是否有推荐的替代方案？
```

**步骤 4: 评估结果**
- 如果包已弃用：查找替代方案
- 如果包不再维护：评估风险，考虑替代
- 如果包正常维护：可以继续使用，但需关注更新

**步骤 5: 记录决策**
```
包名: @charer/react-native-tencentmap-geolocation
状态: [ ] 继续使用 / [ ] 需要替代 / [ ] 已弃用
替代方案: [如果有]
备注: [检查结果和决策理由]
```

### 已知包状态（基于检查）

根据 `DEPRECATED_PACKAGES_REPORT.md` 的检查结果：

✅ **所有当前使用的包均未被弃用**

⚠️ **版本更新建议**：
- `eslint`: 8.x → 9.x（主版本升级，需测试）
- `jest`: 29.x → 30.x（主版本升级，需测试）
- `prettier`: 2.x → 3.x（主版本升级，需测试）

### ⚠️ 需要特别检查的包

以下包需要到 npm 官网仔细检查：

1. **`@charer/react-native-tencentmap-geolocation`**
   - 检查链接：https://www.npmjs.com/package/@charer/react-native-tencentmap-geolocation
   - 检查项：
     - 是否有弃用警告
     - 最后更新时间
     - 是否有推荐的替代包
     - GitHub 仓库是否活跃

2. **`@react-native-vector-icons/feather`**
   - 检查链接：https://www.npmjs.com/package/@react-native-vector-icons/feather
   - 检查项：
     - 是否与 `react-native-vector-icons` 重复
     - 是否有推荐的导入方式
     - 官方文档推荐的使用方法

3. **`@react-native/new-app-screen`**
   - 检查链接：https://www.npmjs.com/package/@react-native/new-app-screen
   - 检查项：
     - 是否仅用于开发环境
     - 是否可以移除
     - 是否有替代方案

4. **`@google/genai`** (holofortune 使用，react_init 未包含)
   - 检查链接：https://www.npmjs.com/package/@google/genai
   - 检查项：
     - 是否需要迁移到 react_init
     - 最新版本和维护状态

---

## 📄 页面迁移步骤

### 步骤 1: 复制页面文件

```bash
# 从 holofortune 复制页面到 react_init
cp holofortune/pages/Login.tsx react_init/src/pages/Login.tsx
cp holofortune/pages/MapHome.tsx react_init/src/pages/MapHome.tsx
# ... 其他页面
```

### 步骤 2: 更新导入路径

**holofortune**:
```typescript
import { MobileLayout } from '../components/Shared';
import { useStore } from '../store';
```

**react_init**:
```typescript
import { MobileLayout } from '../components/Shared';
import { useStore } from '../store';
// 路径保持不变，因为目录结构相同
```

### 步骤 3: 转换样式

#### 3.1 移除主题化颜色（如需要完全匹配 holofortune）

**⚠️ 重要**：为了与 holofortune 完全一致，所有颜色值必须使用硬编码，而不是主题化颜色。

**原代码（主题化）**:
```typescript
import { getTheme } from '../styles/theme';
const colors = getTheme(theme);
<Text style={{ color: colors.textPrimary }}>Hello</Text>
```

**修改为（硬编码，匹配 holofortune）**:
```typescript
// 移除 getTheme 导入和 colors 变量
<Text style={{ color: '#1e293b' }}>Hello</Text>
```

**颜色值对照表**（从 holofortune/style.css 提取）：
- `--text-primary`: `#1e293b`
- `--text-secondary`: `#64748b`
- `--primary-color`: `#3b82f6`
- `--danger-color`: `#ef4444`
- `--nav-active`: `#14b8a6` (light) / `#2dd4bf` (dark)
- `--nav-text`: `#64748b` (light) / `#94a3b8` (dark)

#### 3.2 确保样式完全匹配

对比 `holofortune` 的 CSS 和 `react_init` 的 StyleSheet：

```typescript
// holofortune/style.css
.friendName {
  font-weight: 700;
  color: #1e293b;
  font-size: 16px;
}

// react_init/src/pages/FriendsList.tsx
friendName: {
  fontWeight: '700',
  color: '#1e293b',
  fontSize: 16,
}
```

### 步骤 4: 更新组件引用

确保所有组件引用正确：

- `MobileLayout` → `src/components/Shared.tsx`
- `GlassCard` → `src/components/Shared.tsx`
- `Button` → `src/components/Shared.tsx`
- `Input` → `src/components/Shared.tsx`
- `Header` → `src/components/Shared.tsx`
- `BottomNav` → `src/components/Shared.tsx`（自动显示，无需手动添加）

### 步骤 5: 检查导航配置

确保页面已在 `src/navigation/index.tsx` 中注册：

```typescript
// src/navigation/index.tsx
<Stack.Screen name="Login" component={Login} />
<Stack.Screen name="MapHome" component={MapHome} />
// ... 其他页面
```

### 步骤 6: 测试页面

1. 运行应用：`npm start` 或 `npx react-native start`
2. 检查页面样式是否与 holofortune 完全一致
3. 检查所有交互功能是否正常
4. 检查导航是否正常工作

---

## 🔍 常见问题

### Q1: 页面样式与 holofortune 不一致怎么办？

**A**: 
1. 对比 `holofortune/style.css` 和 `react_init/src/pages/<PageName>.tsx` 的样式
2. 确保所有颜色值、间距、字体大小完全一致
3. 检查是否有遗漏的样式属性

### Q2: 图标显示为 'X' 怎么办？

**A**: 
1. 检查 `android/app/build.gradle` 是否包含：
   ```gradle
   apply from: file("../../node_modules/react-native-vector-icons/fonts.gradle")
   project.ext.vectoricons = [ iconFontNames: [ 'Feather.ttf' ] ]
   ```
2. 确保 `android/app/src/main/assets/fonts/Feather.ttf` 存在
3. 执行完全清理和重建：
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npx react-native run-android
   ```

### Q3: 底部导航不显示怎么办？

**A**: 
1. 检查页面是否使用了 `MobileLayout` 组件
2. 检查 `MobileLayout` 的 `showNav` 属性是否正确
3. 确保页面在 `MainTabs` 中（MapHome, AIAssistant, Shop, Profile）或需要显示导航的页面设置了 `showNav={true}`

### Q4: 如何检查包是否过时？

**A**: 
1. **访问 npm 官网**：`https://www.npmjs.com/package/<package-name>`
2. **检查页面顶部**：是否有红色 "deprecated" 警告横幅
3. **查看包描述**：是否有 "This package is deprecated" 或类似说明
4. **查看 README**：是否有迁移指南或推荐的替代包
5. **检查最后更新时间**：如果超过 1 年未更新，需谨慎使用
6. **查看 GitHub 仓库**：检查仓库是否归档（archived）或不再维护
7. **查看下载量趋势**：如果下载量持续下降，可能表示包不再受欢迎

**示例检查流程**：
```
1. 打开 https://www.npmjs.com/package/@charer/react-native-tencentmap-geolocation
2. 查看页面顶部是否有 "⚠️ This package is deprecated" 警告
3. 查看包描述中是否有替代方案推荐
4. 查看 "Last publish" 时间
5. 点击 GitHub 链接，检查仓库状态
6. 查看 Issues 和 Pull Requests 的活跃度
```

### Q5: 发现包已弃用怎么办？

**A**: 
1. **查看包的 npm 页面**：
   - 检查是否有推荐的替代包（通常在 deprecated 警告中说明）
   - 查看包的 README 是否有迁移指南

2. **查看包的 GitHub 仓库**：
   - 检查是否有迁移指南（Migration Guide）
   - 查看 Issues 中是否有相关讨论
   - 查看是否有 Fork 版本在维护

3. **搜索社区推荐**：
   - 在 GitHub 上搜索类似功能的包
   - 查看 React Native 官方文档推荐的包
   - 在 Stack Overflow 或 Reddit 上查找替代方案

4. **评估替代方案**：
   - 检查替代包的维护状态
   - 检查替代包的 API 兼容性
   - 检查替代包的文档完整性

5. **实施迁移**：
   - 更新 `package.json` 使用替代包
   - 更新代码中的导入和使用方式
   - 充分测试新包的功能

6. **如果无替代方案**：
   - 评估是否可以移除该功能
   - 考虑自己维护 Fork 版本
   - 寻找社区维护的替代实现

### Q6: MapHome 页面不显示地图？

**A**: 
1. 检查 `react-native-maps` 是否正确安装和链接
2. 检查 `android/app/src/main/AndroidManifest.xml` 是否包含位置权限
3. 检查 `react-native.config.js` 配置是否正确
4. 执行完全清理和重建

---

## ✅ 检查清单

### 迁移前检查

- [ ] 已阅读 React Native 官方最新文档
- [ ] 已检查所有依赖包在 npm 上的状态
- [ ] 已确认需要迁移的页面列表
- [ ] 已备份 holofortune 项目

### 迁移过程检查

- [ ] 页面文件已复制到 `src/pages/`
- [ ] 所有导入路径已更新
- [ ] 样式已从 CSS 转换为 StyleSheet
- [ ] 所有颜色值已硬编码（与 holofortune 一致）
- [ ] 所有间距、字体、圆角等样式属性已匹配
- [ ] 页面已在导航中注册
- [ ] 组件引用正确

### 迁移后检查

- [ ] 页面样式与 holofortune 完全一致
- [ ] 所有功能正常工作
- [ ] 导航正常工作
- [ ] 图标正常显示
- [ ] 底部导航正常显示
- [ ] 无控制台错误
- [ ] 无 TypeScript 错误
- [ ] 已测试所有页面

### 依赖包检查

- [ ] 所有包在 npm 上未被弃用
- [ ] 已检查是否有推荐的替代包
- [ ] 已更新到最新稳定版本（如适用）
- [ ] 已运行 `npm audit` 检查安全漏洞
- [ ] 已阅读所有包的最新文档

---

## 📚 参考资源

### React Native 官方文档

- [React Native 官方文档](https://reactnative.dev/docs/getting-started)
- [React Navigation 文档](https://reactnavigation.org/docs/getting-started)
- [React Native 向量图标](https://github.com/oblador/react-native-vector-icons)
- [React Native Maps](https://github.com/react-native-maps/react-native-maps)

### 工具和检查

- [npm 包搜索](https://www.npmjs.com/)
- [npm 包状态检查](https://www.npmjs.com/package/<package-name>)
- [npm outdated 命令](https://docs.npmjs.com/cli/v8/commands/npm-outdated)
- [npm audit 命令](https://docs.npmjs.com/cli/v8/commands/npm-audit)

### 项目文档

- [DEPRECATED_PACKAGES_REPORT.md](./DEPRECATED_PACKAGES_REPORT.md) - 包弃用状态报告

---

## 🚀 快速开始

### 1. 准备环境

```bash
cd poly_apps/react_init
pnpm install
```

### 2. 迁移单个页面示例

以 `Login.tsx` 为例：

```bash
# 1. 复制文件
cp ../holofortune/pages/Login.tsx src/pages/Login.tsx

# 2. 编辑文件，移除主题化颜色
# 将所有 colors.textPrimary 改为 '#1e293b'
# 将所有 colors.primary 改为 '#3b82f6'
# ... 等等

# 3. 确保样式完全匹配 holofortune/style.css

# 4. 测试页面
npx react-native start
```

### 3. 批量迁移

1. 复制所有页面文件
2. 批量替换主题化颜色为硬编码值
3. 逐个检查样式匹配
4. 测试所有页面

---

## 📝 注意事项

1. **样式优先**：页面样式必须与 holofortune 完全一致，这是最高优先级
2. **官方规范**：底层实现遵循 React Native 官方最新文档
3. **包状态检查**：迁移前必须检查每个包在 npm 上的状态
4. **测试充分**：每个页面迁移后都要充分测试
5. **文档更新**：迁移过程中及时更新相关文档

---

## 🔄 持续维护

### 定期检查

- **每月**：检查依赖包更新
- **每季度**：检查是否有包被弃用
- **每年**：评估是否需要升级 React Native 主版本

### 检查命令

```bash
# 检查过时的包
npm outdated

# 检查安全漏洞
npm audit

# 检查弃用的包（需要安装工具）
npm install -g npm-deprecated-check
ndc current
```

---

**文档维护者**: 开发团队  
**最后更新**: 2025-12-02  
**版本**: 1.0

