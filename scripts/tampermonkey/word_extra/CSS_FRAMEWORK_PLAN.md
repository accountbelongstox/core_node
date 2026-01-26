# CSS 框架选择方案

## 可用的在线 CSS 框架（有预编译 CSS，适合生产环境）

### 1. **Bootstrap 5.3** ⭐⭐⭐⭐⭐
- **官方 CDN**: `https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css`
- **官方文档**: https://getbootstrap.com/docs/5.3/
- **优点**: 
  - 最流行，社区支持好
  - 完整的组件系统
  - 官方维护，稳定可靠
  - 有 integrity hash，安全性好
- **缺点**: 
  - 类名与 Tailwind 不同，需要重写 HTML
  - 体积较大（~200KB）

### 2. **Bulma** ⭐⭐⭐⭐
- **CDN**: `https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css`
- **官方文档**: https://bulma.io/
- **优点**:
  - 基于 Flexbox，现代设计
  - 简洁的类名
  - 纯 CSS，无 JavaScript 依赖
- **缺点**: 
  - 类名与 Tailwind 不同
  - 更新频率较低

### 3. **Tachyons** ⭐⭐⭐⭐⭐ (推荐用于工具类)
- **CDN**: `https://unpkg.com/tachyons@4.12.0/css/tachyons.min.css`
- **官方文档**: https://tachyons.io/
- **优点**:
  - 工具类优先，类似 Tailwind
  - 预编译 CSS，可直接使用
  - 轻量级
  - 类名风格接近 Tailwind
- **缺点**: 
  - 类名不完全匹配 Tailwind（如 `bg-black` vs `bg-near-black`）
  - 需要一些适配

### 4. **Foundation** ⭐⭐⭐
- **CDN**: `https://cdn.jsdelivr.net/npm/foundation-sites@6.7.5/dist/css/foundation.min.css`
- **官方文档**: https://get.foundation/
- **优点**: 功能丰富
- **缺点**: 体积大，类名不同

### 5. **Pure CSS** ⭐⭐⭐
- **CDN**: `https://cdn.jsdelivr.net/npm/purecss@3.0.0/build/pure-min.css`
- **官方文档**: https://purecss.io/
- **优点**: 极轻量级
- **缺点**: 功能较少

## 推荐方案

### 方案 1：Tachyons + 自定义 CSS（推荐）✅
**适用场景**: HTML 中已使用 Tailwind 风格类名

**实现方式**:
1. 使用 Tachyons 提供基础工具类
2. 添加自定义 CSS 来补充 Tailwind 特有的类名（如 `bg-black`, `text-white`, `rounded-lg` 等）
3. 在 Shadow DOM 中加载

**优点**:
- 最小改动，保持现有 HTML 结构
- Tachyons 提供大部分工具类
- 自定义 CSS 补充缺失的类名
- 适合 Shadow DOM

**CDN 链接**:
```javascript
// Tachyons
https://unpkg.com/tachyons@4.12.0/css/tachyons.min.css

// 自定义 CSS 在 <style> 标签中定义
```

### 方案 2：Bootstrap + 自定义 CSS
**适用场景**: 需要完整的组件系统

**实现方式**:
1. 使用 Bootstrap 提供基础样式和组件
2. 添加自定义 CSS 来模拟 Tailwind 类名
3. 逐步将 HTML 迁移到 Bootstrap 类名

**优点**:
- 功能完整
- 社区支持好
- 长期维护

**缺点**:
- 需要大量自定义 CSS 来匹配 Tailwind 类名
- 或者需要重写 HTML

**CDN 链接**:
```javascript
// Bootstrap 5.3
https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css
```

### 方案 3：纯自定义 CSS（轻量级）
**适用场景**: 只需要少量样式，不想引入大型框架

**实现方式**:
1. 不引入外部框架
2. 在 `<style>` 标签中定义所有需要的类名
3. 完全控制样式

**优点**:
- 无外部依赖
- 体积最小
- 完全控制

**缺点**:
- 需要手动编写所有样式
- 维护成本高

## 最终推荐

**选择方案 1：Tachyons + 自定义 CSS**

**理由**:
1. ✅ HTML 中已使用 Tailwind 风格类名，Tachyons 最接近
2. ✅ 有预编译 CSS，可直接通过 CDN 使用
3. ✅ 适合 Shadow DOM 环境
4. ✅ 只需少量自定义 CSS 补充即可
5. ✅ 生产环境可用，无警告

**实施步骤**:
1. 加载 Tachyons CSS
2. 在 `<style>` 标签中添加自定义 CSS，补充 Tailwind 特有类名
3. 测试并调整
