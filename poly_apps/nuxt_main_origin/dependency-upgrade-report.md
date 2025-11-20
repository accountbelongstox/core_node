# 依赖升级报告

生成时间: 2025-07-17 19:39:16

## 当前环境信息
- Node.js 版本: v22.15.0
- npm 版本: 10.9.2
- yarn 版本: 1.22.22

## 主要版本冲突问题
1. **nuxt@3.0.0** - 与 Node.js 22.15.0 不兼容，需要升级到支持新版本 Node.js 的版本
2. **apexcharts** 与 **vue3-apexcharts** - 版本冲突，需要同步升级

## 依赖升级对应表

### DevDependencies

| 包名 | 当前版本 | 推荐版本 | 说明 |
|------|----------|----------|------|
| @nuxtjs/i18n | ^8.0.0-beta.9 | ^9.5.6 | 建议升级 |
| @rollup/plugin-alias | ^3.1.9 | ^5.1.1 | 建议升级 |
| @tailwindcss/forms | ^0.5.3 | ^0.5.10 | 建议升级 |
| @tailwindcss/line-clamp | ^0.4.2 | ^0.4.4 | 建议升级 |
| @tailwindcss/typography | ^0.5.7 | ^0.5.16 | 建议升级 |
| autoprefixer | ^10.4.12 | ^10.4.21 | 建议升级 |
| nuxt | 3.0.0 | ^4.0.0 | 建议升级 |
| postcss | ^8.4.17 | ^8.5.6 | 建议升级 |
| prettier | ^2.8.0 | ^3.6.2 | 建议升级 |
| prettier-plugin-tailwindcss | ^0.2.0 | ^0.6.14 | 建议升级 |
| tailwindcss | ^3.1.8 | ^4.1.11 | 建议升级 |
| typescript | ^4.6.4 | ^5.8.3 | 建议升级 |
| vue-tsc | ^0.40.4 | ^3.0.1 | 建议升级 |

### Dependencies

| 包名 | 当前版本 | 推荐版本 | 说明 |
|------|----------|----------|------|
| @bhplugin/vue3-datatable | ^1.0.1 | ^2.0.2 | 建议升级 |
| @fullcalendar/core | ^5.11.0 | ^6.1.18 | 建议升级 |
| @fullcalendar/daygrid | ^5.11.0 | ^6.1.18 | 建议升级 |
| @fullcalendar/interaction | ^5.11.0 | ^6.1.18 | 建议升级 |
| @fullcalendar/timegrid | ^5.11.0 | ^6.1.18 | 建议升级 |
| @fullcalendar/vue3 | ^5.11.1 | ^6.1.18 | 建议升级 |
| @headlessui/vue | ^1.7.3 | ^1.7.23 | 建议升级 |
| @pinia/nuxt | ^0.4.6 | ^0.11.1 | 建议升级 |
| @suadelabs/vue3-multiselect | ^1.0.2 | ^1.0.2 | 建议升级 |
| @vuelidate/core | ^2.0.0 | ^2.0.3 | 建议升级 |
| @vuelidate/validators | ^2.0.0 | ^2.0.4 | 建议升级 |
| @vueuse/core | ^9.3.0 | ^13.5.0 | 建议升级 |
| @vueuse/head | ^0.9.7 | ^2.0.0 | 建议升级 |
| apexcharts | ^3.35.5 | ^5.2.0 | 需要与vue3-apexcharts同步升级 |
| easymde | ^2.18.0 | ^2.20.0 | 建议升级 |
| file-upload-with-preview | ^4.2.0 | ^6.1.2 | 建议升级 |
| highlight.js | ^11.3.1 | ^11.11.1 | 建议升级 |
| maska | ^1.5.0 | ^3.2.0 | 建议升级 |
| path | ^0.12.7 | ^0.12.7 | 建议升级 |
| pinia | ^2.0.22 | ^3.0.3 | 建议升级 |
| sweetalert2 | ^11.5.1 | ^11.22.2 | 建议升级 |
| swiper | ^8.4.4 | ^11.2.10 | 建议升级 |
| tippy.vue | ^3.2.1 | ^3.2.1 | 建议升级 |
| vue-clipboard3 | ^2.0.0 | ^2.0.0 | 建议升级 |
| vue-countup-v3 | ^1.0.14 | ^1.4.2 | 建议升级 |
| vue-draggable-next | ^2.1.1 | ^2.2.1 | 建议升级 |
| vue-easy-lightbox | ^1.9.0 | ^1.19.0 | 建议升级 |
| vue-flatpickr-component | ^11.0.1 | ^12.0.0 | 建议升级 |
| vue-height-collapsible | ^0.1.1 | ^0.1.1 | 建议升级 |
| vue-simple-range-slider | ^1.0.0 | ^1.1.0 | 建议升级 |
| vue3-apexcharts | ^1.4.1 | ^1.8.0 | 需要apexcharts>=4.0.0 |
| vue3-easymde | ^1.0.0 | ^1.0.1 | 建议升级 |
| vue3-form-wizard | ^0.1.6 | ^0.2.4 | 建议升级 |
| vue3-json-excel | ^1.0.10-alpha | ^1.0.10-alpha | 建议升级 |
| vue3-number-spinner | ^0.0.9 | ^0.0.9 | 建议升级 |
| vue3-perfect-scrollbar | ^1.6.0 | ^2.0.0 | 建议升级 |
| vue3-popper | ^1.5.0 | ^1.5.0 | 建议升级 |
| vue3-quill | ^0.2.9 | ^0.3.1 | 建议升级 |

## 升级建议和步骤

### 1. 核心框架升级
```bash
# 升级 Nuxt 到支持 Node.js 22 的版本
npm install nuxt@latest

# 或者使用 yarn
yarn upgrade nuxt@latest
```

### 2. 解决 ApexCharts 版本冲突
```bash
# 同时升级 apexcharts 和 vue3-apexcharts
npm install apexcharts@latest vue3-apexcharts@latest

# 或者使用 yarn
yarn upgrade apexcharts@latest vue3-apexcharts@latest
```

### 3. 批量升级所有依赖 (谨慎操作)
```bash
# 删除 node_modules 和锁文件
rm -rf node_modules package-lock.json yarn.lock

# 升级所有依赖到最新版本
npx npm-check-updates -u

# 重新安装
npm install

# 或者使用 yarn
yarn install
```

### 4. 逐步升级 (推荐)
```bash
# 1. 先升级核心依赖
npm install nuxt@latest @nuxtjs/i18n@latest

# 2. 再升级其他依赖
npm install apexcharts@latest vue3-apexcharts@latest

# 3. 测试应用是否正常运行
npm run dev

# 4. 如果有问题，回滚并逐个解决
```

## 注意事项

1. **Node.js 版本**: 当前使用 Node.js 22.15.0，确保所有依赖都支持此版本
2. **渐进式升级**: 建议先升级核心依赖，然后逐步升级其他包
3. **测试**: 每次升级后都要测试应用功能
4. **备份**: 升级前建议备份当前项目

## 兼容性检查命令
```bash
# 检查依赖冲突
npm ls

# 检查过时的包
npm outdated

# 检查安全漏洞
npm audit

# 修复安全漏洞
npm audit fix
```

