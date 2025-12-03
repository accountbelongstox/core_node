# React Native WebView 地图集成指南

## 🎯 为什么使用 WebView + OpenStreetMap？

### 优势
- ✅ **完全免费** - 无需 Google Maps API key
- ✅ **快速开发** - 可复用 Web 代码（与 D:\programing\test 项目一致）
- ✅ **跨平台统一** - iOS 和 Android 显示完全一致
- ✅ **开源** - OpenStreetMap 是开源地图数据
- ✅ **易于调试** - 使用熟悉的 Web 技术栈

### 劣势
- ⚠️ **性能稍弱** - WebView 渲染比原生稍慢
- ⚠️ **功能受限** - 某些原生功能不支持
- ⚠️ **内存占用** - WebView 需要额外内存

## 📦 安装步骤

### 1. 安装 react-native-webview

```bash
cd poly_apps/react_init
pnpm install react-native-webview
```

### 2. 链接原生依赖（自动）

React Native 0.60+ 支持自动链接，无需手动配置。

### 3. iOS 额外步骤（如果使用 iOS）

```bash
cd ios
pod install
cd ..
```

## 🚀 使用示例

### 方案 A: 使用提供的示例组件

1. 重命名示例文件：
```bash
mv src/pages/MapHomeWebView.tsx.example src/pages/MapHomeWebView.tsx
```

2. 在导航中使用：
```typescript
// src/navigation/index.tsx
import MapHomeWebView from '../pages/MapHomeWebView';

// 替换原来的 MapHome
<Tab.Screen name="MapHome" component={MapHomeWebView} />
```

### 方案 B: 使用第三方库

#### 选项 1: react-native-webview-leaflet
```bash
pnpm install react-native-webview-leaflet
```

```typescript
import WebViewLeaflet from 'react-native-webview-leaflet';

<WebViewLeaflet
  mapCenterPosition={{
    lat: activeFriend.location.lat,
    lng: activeFriend.location.lng,
  }}
/>
```

#### 选项 2: react-native-leaflet-map
```bash
pnpm install react-native-leaflet-map
```

## 🔧 自定义配置

### 修改地图样式

在 `MapHomeWebView.tsx.example` 中修改 Leaflet HTML：

```javascript
// 更改为深色主题瓦片
L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; Stadia Maps'
}).addTo(map);

// 或使用其他瓦片提供商
// CartoDB Dark: https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png
// Stamen Toner: https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png
```

### 添加地图交互

```javascript
// 在 leafletHTML 中添加
map.on('click', function(e) {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'mapClick',
    lat: e.latlng.lat,
    lng: e.latlng.lng
  }));
});
```

```typescript
// 在 React Native 组件中处理
const handleMessage = (event: any) => {
  const data = JSON.parse(event.nativeEvent.data);
  if (data.type === 'mapClick') {
    console.log('地图点击位置:', data.lat, data.lng);
    // 处理点击事件
  }
};
```

## 📊 性能对比

### WebView + OpenStreetMap
- 首次加载: ~1-2 秒
- 地图缩放: 流畅
- 标记添加: 快速
- 内存占用: ~50-80MB

### 原生 Google Maps
- 首次加载: ~0.5-1 秒
- 地图缩放: 非常流畅
- 标记添加: 非常快速
- 内存占用: ~30-50MB

## 🔄 从 Google Maps 迁移到 OpenStreetMap

### 替换步骤

1. **安装 WebView**
```bash
pnpm install react-native-webview
```

2. **重命名示例文件**
```bash
mv src/pages/MapHomeWebView.tsx.example src/pages/MapHomeWebView.tsx
```

3. **更新导航**
```typescript
// src/navigation/index.tsx
- import MapHome from '../pages/MapHome';
+ import MapHome from '../pages/MapHomeWebView';
```

4. **删除 Google Maps 配置（可选）**
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<!-- 注释或删除以下内容 -->
<!--
<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="YOUR_GOOGLE_MAPS_API_KEY_HERE"/>
-->
```

## 📚 参考资源

- [React Native WebView 官方文档](https://github.com/react-native-webview/react-native-webview)
- [Leaflet 官方文档](https://leafletjs.com/)
- [OpenStreetMap](https://www.openstreetmap.org/)
- [react-native-webview-leaflet](https://github.com/reggie3/react-native-webview-leaflet)
- [react-native-leaflet-map](https://github.com/weishenho/react-native-leaflet-map)
- [Medium: How to implement Leaflet in React Native](https://medium.com/@bmyadav91/how-to-implement-leaflet-view-maps-in-react-native-732b3f94a76c)

## 🐛 常见问题

### Q: WebView 显示空白？
A: 确保 `javaScriptEnabled={true}` 和 `domStorageEnabled={true}`

### Q: 地图加载慢？
A: 使用 `startInLoadingState={true}` 显示加载指示器

### Q: iOS 地图不显示？
A: 检查 Info.plist 中是否允许 HTTP 请求（如果使用 HTTP 瓦片）

### Q: 如何调试 WebView 内容？
A:
- Android: Chrome DevTools (chrome://inspect)
- iOS: Safari Web Inspector

## 💡 建议

- **开发阶段**: 使用 WebView + OpenStreetMap（免费，快速）
- **生产环境**: 根据需求选择
  - 功能简单: WebView + OpenStreetMap
  - 高性能要求: 原生 Google Maps
  - 预算充足: 原生 Google Maps
  - 完全免费: WebView + OpenStreetMap
