# PyBrowserAuto 设计规范

> **项目重命名**: document_offline → pybrowserauto
> **设计日期**: 2025-11-17
> **版本**: 2.0.0

---

## 1. 项目概述

### 1.1 项目定位

**PyBrowserAuto** 是基于 PyBrowser 核心库的浏览器自动化工具包，提供：

- ✅ **网页离线下载**（原 document_offline 功能）
- 🆕 **页面自动化截图**
- 🆕 **多页面智能切换**
- 🆕 **截图对比与合并**
- 🆕 **批量页面处理**

### 1.2 核心依赖

```
pycore/pyutils/pybrowser/          # PyBrowser 核心库（已存在）
├── interfaces/                    # IBrowser, IPage 接口
├── implementations/               # ChromeBrowser, EnhancedPage 实现
├── fetchers/                      # HTTP, Browser, Iframe Fetchers
├── plugins/                       # ContentPlugin, ScreenshotPlugin
└── utils/                         # PageUtils, NavigationUtils

pycore/pyctl/pybrowserauto/        # PyBrowserAuto 控制层（新名称）
├── core/                          # 核心组件（保留原有）
├── processor/                     # 处理器（扩展新功能）
├── controller/                    # 控制器（扩展自动化）
└── automation/                    # 🆕 自动化模块（新增）
```

---

## 2. 架构设计

### 2.1 新架构层级

```
┌─────────────────────────────────────────────────────────────┐
│                    Public API Layer                          │
│         pybrowserauto_manager (singleton)                    │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Controller Layer                           │
│  CrawlController │ AutomationController (🆕)                 │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Automation Layer (🆕)                      │
│  PageSwitcher │ ScreenshotManager │ ImageMerger             │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  PyBrowser Layer (复用)                      │
│  EnhancedPage │ ScreenshotPlugin │ BrowserFetcher           │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  PyBrowser Utils (扩展)                      │
│  ImageUtils (🆕) │ PageUtils │ NavigationUtils              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构（新）

```
pycore/pyctl/pybrowserauto/         # 重命名自 document_offline
├── __init__.py                     # 导出 pybrowserauto_manager
├── pybrowserauto_manager.py        # 🆕 主管理器（替代 offline_manager）
│
├── core/                           # 核心组件（保留）
│   ├── __init__.py
│   ├── domain_context.py
│   ├── file_mapper.py
│   ├── url_queue.py
│   └── url_rewriter.py
│
├── processor/                      # 处理器（保留+扩展）
│   ├── __init__.py
│   ├── resource_processor.py       # 保留
│   ├── html_processor.py           # 保留
│   ├── css_processor.py            # 保留
│   └── image_processor.py          # 🆕 图片处理器
│
├── controller/                     # 控制器（保留+扩展）
│   ├── __init__.py
│   ├── crawl_controller.py         # 保留（网页下载控制器）
│   ├── cli_controller.py           # 保留
│   └── automation_controller.py    # 🆕 自动化控制器
│
├── automation/                     # 🆕 自动化模块（新增）
│   ├── __init__.py
│   ├── page_switcher.py            # 🆕 页面切换器
│   ├── screenshot_manager.py       # 🆕 截图管理器
│   └── batch_processor.py          # 🆕 批量处理器
│
└── docs/                           # 文档（更新）
    ├── ARCHITECTURE.md             # 架构文档（更新）
    ├── API_REFERENCE.md            # API 参考（更新）
    ├── MIGRATION_GUIDE.md          # 🆕 迁移指南（v1→v2）
    └── AUTOMATION_GUIDE.md         # 🆕 自动化使用指南


pycore/pyutils/pybrowser/utils/     # PyBrowser 工具扩展
├── __init__.py
├── page_utils.py                   # 保留
├── navigation_utils.py             # 保留
└── image_utils.py                  # 🆕 图片工具（新增）
```

---

## 3. 新增功能设计

### 3.1 图片工具 (ImageUtils)

**位置**: `pycore/pyutils/pybrowser/utils/image_utils.py`

**功能**:

#### 1. 图片加载
```python
class ImageUtils:
    """图片工具类（静态方法）"""

    @staticmethod
    def load_image(source: str) -> Image:
        """
        加载图片（支持 URL 或本地路径）

        Args:
            source: 图片源（URL 或本地文件路径）

        Returns:
            PIL.Image 对象

        Examples:
            # 本地路径
            img = ImageUtils.load_image('/path/to/image.png')

            # URL
            img = ImageUtils.load_image('https://example.com/image.jpg')
        """
        pass
```

#### 2. 图片合并
```python
    @staticmethod
    def merge_images_horizontal(images: List[Image], spacing: int = 0) -> Image:
        """
        水平合并图片

        Args:
            images: PIL.Image 对象列表
            spacing: 图片间距（像素）

        Returns:
            合并后的 PIL.Image 对象
        """
        pass

    @staticmethod
    def merge_images_vertical(images: List[Image], spacing: int = 0) -> Image:
        """
        垂直合并图片

        Args:
            images: PIL.Image 对象列表
            spacing: 图片间距（像素）

        Returns:
            合并后的 PIL.Image 对象
        """
        pass

    @staticmethod
    def merge_images_grid(images: List[Image], cols: int = 2, spacing: int = 0) -> Image:
        """
        网格布局合并图片

        Args:
            images: PIL.Image 对象列表
            cols: 列数
            spacing: 图片间距（像素）

        Returns:
            合并后的 PIL.Image 对象
        """
        pass
```

#### 3. 图片保存
```python
    @staticmethod
    def save_image(image: Image, path: str, format: str = 'PNG', quality: int = 95):
        """
        保存图片

        Args:
            image: PIL.Image 对象
            path: 保存路径
            format: 图片格式（PNG, JPEG, WebP 等）
            quality: 质量（1-100，仅用于 JPEG）
        """
        pass
```

#### 4. 图片对比（可选）
```python
    @staticmethod
    def compare_images(img1: Image, img2: Image) -> Dict:
        """
        对比两张图片的差异

        Args:
            img1: 第一张图片
            img2: 第二张图片

        Returns:
            对比结果字典:
            {
                'identical': bool,           # 是否完全相同
                'similarity': float,         # 相似度（0-1）
                'diff_image': Image,         # 差异图（可选）
                'diff_pixels': int           # 差异像素数
            }
        """
        pass
```

**依赖管理**:
```python
# pycore/pyfoundations/third_party.py 中添加
DEPENDENCY_MAP = {
    # ... 现有依赖
    'PIL': 'Pillow',           # 图片处理
}

# pycore/pyutils/pybrowser/utils/image_utils.py 中使用
from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageDraw

def load_image(source: str):
    Image = get_third_package_PIL_Image()
    # 使用 Image.open() 等方法
```

---

### 3.2 截图管理器 (ScreenshotManager)

**位置**: `pycore/pyctl/pybrowserauto/automation/screenshot_manager.py`

**功能**:

```python
class ScreenshotManager:
    """
    截图管理器

    提供高级截图功能，整合 PyBrowser 的截图能力
    """

    def __init__(self, session):
        """
        初始化截图管理器

        Args:
            session: PyBrowser Session 对象
        """
        self.session = session
        self.screenshot_plugin = None

    def initialize(self):
        """加载 ScreenshotPlugin"""
        self.screenshot_plugin = self.session.load_plugin('screenshot')

    def take_screenshot(self, page, output_path: str = None) -> bytes:
        """
        截取当前页面

        Args:
            page: IPage 对象
            output_path: 保存路径（可选）

        Returns:
            截图字节流

        复用: StandardPage.screenshot()
        """
        pass

    def take_fullpage_screenshot(self, page, output_path: str = None) -> bytes:
        """
        截取完整页面（含滚动区域）

        Args:
            page: IPage 对象
            output_path: 保存路径（可选）

        Returns:
            截图字节流

        复用: ScreenshotPlugin.take_fullpage_screenshot()
        """
        pass

    def take_and_merge_screenshot(
        self,
        page,
        reference_image_source: str,
        output_path: str,
        merge_mode: str = 'horizontal'
    ) -> str:
        """
        截图并与参考图合并

        Args:
            page: IPage 对象
            reference_image_source: 参考图来源（URL 或本地路径）
            output_path: 合并图保存路径
            merge_mode: 合并模式（'horizontal', 'vertical', 'grid'）

        Returns:
            保存的文件路径

        流程:
        1. 截取当前页面 (复用 StandardPage.screenshot())
        2. 加载参考图 (调用 ImageUtils.load_image())
        3. 合并图片 (调用 ImageUtils.merge_images_*)
        4. 保存结果 (调用 ImageUtils.save_image())
        """
        pass

    def batch_screenshot_all_pages(
        self,
        browser,
        output_dir: str,
        fullpage: bool = False
    ) -> List[str]:
        """
        批量截取所有标签页

        Args:
            browser: IBrowser 对象
            output_dir: 输出目录
            fullpage: 是否完整页面截图

        Returns:
            截图文件路径列表

        复用:
        - browser.get_pages() 获取所有页面
        - EnhancedPage.switch_to_page_by_index() 切换页面
        - ScreenshotPlugin.take_*_screenshot() 截图
        """
        pass
```

---

### 3.3 页面切换器 (PageSwitcher)

**位置**: `pycore/pyctl/pybrowserauto/automation/page_switcher.py`

**功能**:

```python
class PageSwitcher:
    """
    页面切换器

    智能页面/标签页管理和切换
    """

    def __init__(self, browser):
        """
        初始化页面切换器

        Args:
            browser: IBrowser 对象（ChromeBrowser, EdgeBrowser 等）
        """
        self.browser = browser

    def switch_by_index(self, index: int) -> bool:
        """
        按索引切换标签页

        Args:
            index: 标签页索引（0-based）

        Returns:
            是否切换成功

        复用: ChromeBrowser.switch_to_tab()
        """
        pass

    def switch_by_url(self, url: str, strict: bool = False) -> bool:
        """
        按 URL 切换标签页

        Args:
            url: 目标 URL
            strict: 是否严格匹配（True: 完全匹配，False: 部分匹配）

        Returns:
            是否切换成功

        复用: EnhancedPage.switch_to_page_by_url()
        """
        pass

    def switch_by_title(self, title: str, partial: bool = True) -> bool:
        """
        按页面标题切换标签页

        Args:
            title: 页面标题
            partial: 是否部分匹配

        Returns:
            是否切换成功

        实现: 遍历所有标签页，匹配 title
        """
        pass

    def open_and_switch(self, url: str, reuse_blank: bool = True) -> bool:
        """
        打开并切换到新页面

        Args:
            url: 目标 URL
            reuse_blank: 是否复用空白页

        Returns:
            是否成功

        复用: EnhancedPage.open_url()（自动复用空白页）
        """
        pass

    def close_current_and_switch(self, fallback_index: int = 0) -> bool:
        """
        关闭当前页并切换到指定页

        Args:
            fallback_index: 关闭后切换到的页面索引

        Returns:
            是否成功

        复用: ChromeBrowser.close_current_tab()
        """
        pass

    def get_all_pages_info(self) -> List[Dict]:
        """
        获取所有标签页信息

        Returns:
            标签页信息列表:
            [
                {'index': 0, 'url': '...', 'title': '...'},
                {'index': 1, 'url': '...', 'title': '...'}
            ]

        复用: browser.get_pages()
        """
        pass
```

---

### 3.4 自动化控制器 (AutomationController)

**位置**: `pycore/pyctl/pybrowserauto/controller/automation_controller.py`

**功能**:

```python
class AutomationController:
    """
    自动化控制器

    整合页面切换、截图、图片合并等自动化功能
    """

    def __init__(self):
        """初始化自动化控制器"""
        self.browser = None
        self.session = None
        self.page_switcher = None
        self.screenshot_manager = None

    def initialize(self, browser_type: str = 'chrome', headless: bool = False):
        """
        初始化浏览器和自动化组件

        Args:
            browser_type: 浏览器类型（'chrome', 'edge', 'firefox'）
            headless: 是否无头模式

        Returns:
            是否成功

        复用:
        - PyBrowser SpiderEngine
        - SessionManager
        """
        pass

    def navigate_screenshot_merge(
        self,
        url: str,
        reference_image: str,
        output_path: str,
        wait_selector: str = None,
        merge_mode: str = 'horizontal'
    ) -> Dict:
        """
        导航到页面 → 等待加载 → 截图 → 合并图片

        Args:
            url: 目标 URL
            reference_image: 参考图（URL 或本地路径）
            output_path: 合并图保存路径
            wait_selector: 等待的 CSS 选择器（可选）
            merge_mode: 合并模式（'horizontal', 'vertical', 'grid'）

        Returns:
            结果字典:
            {
                'success': bool,
                'screenshot_path': str,       # 截图路径
                'merged_path': str,           # 合并图路径
                'error': str                  # 错误信息（如果失败）
            }

        流程:
        1. 导航到 URL (复用 IPage.goto())
        2. 等待页面加载 (复用 PageUtils.wait_for_load() 或 wait_for_selector())
        3. 截图 (调用 ScreenshotManager.take_screenshot())
        4. 加载参考图 (调用 ImageUtils.load_image())
        5. 合并图片 (调用 ImageUtils.merge_images_*)
        6. 保存结果 (调用 ImageUtils.save_image())
        """
        pass

    def batch_navigate_screenshot_merge(
        self,
        url_list: List[str],
        reference_image: str,
        output_dir: str,
        merge_mode: str = 'horizontal'
    ) -> List[Dict]:
        """
        批量处理多个 URL

        Args:
            url_list: URL 列表
            reference_image: 参考图
            output_dir: 输出目录
            merge_mode: 合并模式

        Returns:
            结果列表

        流程:
        1. 循环遍历 URL 列表
        2. 对每个 URL 调用 navigate_screenshot_merge()
        3. 收集结果
        """
        pass

    def switch_screenshot_merge(
        self,
        target: Union[int, str],
        target_type: str,
        reference_image: str,
        output_path: str,
        merge_mode: str = 'horizontal'
    ) -> Dict:
        """
        切换页面 → 截图 → 合并

        Args:
            target: 切换目标（索引、URL 或标题）
            target_type: 目标类型（'index', 'url', 'title'）
            reference_image: 参考图
            output_path: 输出路径
            merge_mode: 合并模式

        Returns:
            结果字典

        流程:
        1. 切换页面 (调用 PageSwitcher.switch_by_*)
        2. 截图并合并 (调用 ScreenshotManager.take_and_merge_screenshot())
        """
        pass

    def cleanup(self):
        """清理资源"""
        pass
```

---

### 3.5 图片处理器 (ImageProcessor)

**位置**: `pycore/pyctl/pybrowserauto/processor/image_processor.py`

**功能**:

```python
class ImageProcessor:
    """
    图片处理器

    负责图片的预处理、后处理和批量操作
    """

    def __init__(self, output_dir: str):
        """
        初始化图片处理器

        Args:
            output_dir: 输出目录
        """
        self.output_dir = output_dir

    def process_screenshot_merge(
        self,
        screenshot_bytes: bytes,
        reference_source: str,
        output_filename: str,
        merge_mode: str = 'horizontal'
    ) -> str:
        """
        处理截图合并

        Args:
            screenshot_bytes: 截图字节流
            reference_source: 参考图来源
            output_filename: 输出文件名
            merge_mode: 合并模式

        Returns:
            保存的文件路径

        复用: ImageUtils 所有方法
        """
        pass

    def batch_merge_images(
        self,
        image_sources: List[str],
        output_path: str,
        merge_mode: str = 'grid',
        cols: int = 2
    ) -> str:
        """
        批量合并多张图片

        Args:
            image_sources: 图片源列表（路径或 URL）
            output_path: 输出路径
            merge_mode: 合并模式（'horizontal', 'vertical', 'grid'）
            cols: 网格列数（仅 grid 模式）

        Returns:
            保存的文件路径
        """
        pass
```

---

## 4. 代码复用策略

### 4.1 直接复用 PyBrowser 功能

| 功能 | PyBrowser 组件 | 复用方式 |
|------|---------------|---------|
| **页面截图** | `StandardPage.screenshot()` | 直接调用 |
| **完整页面截图** | `ScreenshotPlugin.take_fullpage_screenshot()` | 通过 Session 加载插件 |
| **页面切换（索引）** | `ChromeBrowser.switch_to_tab(index)` | 直接调用 |
| **页面切换（URL）** | `EnhancedPage.switch_to_page_by_url()` | 直接调用 |
| **智能页面打开** | `EnhancedPage.open_url()` | 直接调用（自动复用空白页） |
| **等待页面加载** | `PageUtils.wait_for_load()` | 静态方法调用 |
| **等待元素** | `StandardPage.wait_for_selector()` | 直接调用 |
| **获取所有页面** | `IBrowser.get_pages()` | 直接调用 |

### 4.2 新增功能（需要开发）

| 功能 | 位置 | 依赖 |
|------|------|------|
| **图片加载（URL/本地）** | `ImageUtils.load_image()` | Pillow |
| **图片水平合并** | `ImageUtils.merge_images_horizontal()` | Pillow |
| **图片垂直合并** | `ImageUtils.merge_images_vertical()` | Pillow |
| **图片网格合并** | `ImageUtils.merge_images_grid()` | Pillow |
| **图片对比** | `ImageUtils.compare_images()` | Pillow |
| **截图+合并** | `ScreenshotManager.take_and_merge_screenshot()` | ImageUtils |
| **批量截图** | `ScreenshotManager.batch_screenshot_all_pages()` | PyBrowser |
| **自动化流程** | `AutomationController.navigate_screenshot_merge()` | 所有组件 |

---

## 5. 使用示例

### 5.1 基础使用：截图并合并

```python
from pycore.pyctl.pybrowserauto.controller import AutomationController

# 初始化控制器
controller = AutomationController()
controller.initialize(browser_type='chrome', headless=False)

# 导航到页面 → 截图 → 与参考图合并
result = controller.navigate_screenshot_merge(
    url='https://example.com',
    reference_image='/path/to/reference.png',  # 或 'https://...'
    output_path='/output/merged.png',
    wait_selector='.main-content',  # 等待主内容加载
    merge_mode='horizontal'  # 水平合并
)

if result['success']:
    print(f"合并图已保存: {result['merged_path']}")
else:
    print(f"失败: {result['error']}")

# 清理资源
controller.cleanup()
```

### 5.2 高级使用：多标签页切换截图

```python
from pycore.pyctl.pybrowserauto.controller import AutomationController

controller = AutomationController()
controller.initialize(browser_type='chrome')

# 打开多个标签页
controller.browser.new_tab('https://example.com/page1')
controller.browser.new_tab('https://example.com/page2')
controller.browser.new_tab('https://example.com/page3')

# 切换到第 2 个标签页 → 截图 → 合并
result = controller.switch_screenshot_merge(
    target=1,  # 索引 1
    target_type='index',
    reference_image='https://cdn.example.com/baseline.png',
    output_path='/output/page2_comparison.png',
    merge_mode='vertical'  # 垂直合并
)

controller.cleanup()
```

### 5.3 批量处理

```python
from pycore.pyctl.pybrowserauto.controller import AutomationController

controller = AutomationController()
controller.initialize(browser_type='chrome', headless=True)

# 批量处理多个 URL
results = controller.batch_navigate_screenshot_merge(
    url_list=[
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3'
    ],
    reference_image='/baseline/reference.png',
    output_dir='/output/comparisons/',
    merge_mode='horizontal'
)

for i, result in enumerate(results):
    if result['success']:
        print(f"[{i+1}] 成功: {result['merged_path']}")
    else:
        print(f"[{i+1}] 失败: {result['error']}")

controller.cleanup()
```

### 5.4 直接使用工具类

```python
from pycore.pyutils.pybrowser.utils.image_utils import ImageUtils

# 加载图片
img1 = ImageUtils.load_image('https://example.com/image1.png')
img2 = ImageUtils.load_image('/local/image2.png')

# 水平合并
merged = ImageUtils.merge_images_horizontal([img1, img2], spacing=10)

# 保存
ImageUtils.save_image(merged, '/output/merged.png', format='PNG')

# 对比图片
comparison = ImageUtils.compare_images(img1, img2)
print(f"相似度: {comparison['similarity']}")
```

---

## 6. 命令行接口设计

### 6.1 CLI 扩展

**文件**: `pycore/pyctl/pybrowserauto/controller/cli_controller.py`

**新增命令**:

```bash
# 原有功能（网页下载）
python -m pycore.pyctl.pybrowserauto crawl --url https://example.com --depth 2

# 🆕 自动化截图合并
python -m pycore.pyctl.pybrowserauto screenshot \
    --url https://example.com \
    --reference /path/to/reference.png \
    --output /output/merged.png \
    --mode horizontal \
    --wait-selector ".main-content"

# 🆕 批量截图合并
python -m pycore.pyctl.pybrowserauto batch-screenshot \
    --urls urls.txt \
    --reference baseline.png \
    --output-dir /output/ \
    --mode vertical

# 🆕 多标签页切换截图
python -m pycore.pyctl.pybrowserauto switch-screenshot \
    --target-index 2 \
    --reference baseline.png \
    --output comparison.png
```

---

## 7. 迁移计划

### 7.1 重命名步骤

#### Step 1: 目录重命名
```bash
# 重命名主目录
git mv pycore/pyctl/document_offline pycore/pyctl/pybrowserauto

# 重命名应用目录
git mv pyapps/document_offline pyapps/pybrowserauto
```

#### Step 2: 文件重命名
```bash
# 重命名主管理器
cd pycore/pyctl/pybrowserauto/
git mv offline_manager.py pybrowserauto_manager.py
```

#### Step 3: 代码更新

**所有文件中的字符串替换**:
```python
# 替换模块名
document_offline → pybrowserauto
DocumentOffline → PyBrowserAuto
offline_manager → pybrowserauto_manager

# 更新导入语句
from pycore.pyctl.document_offline → from pycore.pyctl.pybrowserauto
from pyapps.document_offline → from pyapps.pybrowserauto
```

#### Step 4: 文档更新
- `ARCHITECTURE.md` - 更新架构说明
- `API_REFERENCE.md` - 更新 API 文档
- `README.md` - 更新项目描述
- 🆕 `MIGRATION_GUIDE.md` - 创建迁移指南

#### Step 5: Git 提交
```bash
git add -A
git commit -m "Rename document_offline to pybrowserauto

- Rename module: pycore/pyctl/document_offline → pybrowserauto
- Rename manager: offline_manager → pybrowserauto_manager
- Update all imports and references
- Add new automation features (PageSwitcher, ScreenshotManager, ImageUtils)
- Update documentation

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 8. 开发规范遵循

### 8.1 符合 pycore 规范

✅ **Import 规范**
```python
# ✅ 正确：所有 import 在文件顶部
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_PIL_Image
from pycore.pyutils.pybrowser.implementations.pages import EnhancedPage

# ❌ 错误：函数内 import
def some_function():
    from PIL import Image  # 禁止
```

✅ **Try-Except 规范**
```python
# ✅ 正确：使用条件检查和 ColorPrint
def load_image(path):
    if not path:
        ColorPrint.red("Image path is required")
        return None

    if not os.path.exists(path):
        ColorPrint.red(f"Image not found: {path}")
        return None

    # 正常加载
    return Image.open(path)

# ❌ 错误：使用 try-except
def load_image(path):
    try:
        return Image.open(path)
    except Exception as e:  # 禁止
        print(f"Error: {e}")
        return None
```

✅ **第三方库加载**
```python
# ✅ 正确：使用 lazy loading
from pycore.pyfoundations.third_party import get_third_package_PIL_Image

def load_image(path):
    Image = get_third_package_PIL_Image()
    return Image.open(path)

# ❌ 错误：直接 import
from PIL import Image  # 禁止
```

✅ **线程规范**
```python
# ✅ 正确：直接继承 threading.Thread
import threading

class ScreenshotThread(threading.Thread):
    def __init__(self, page, output_path):
        threading.Thread.__init__(self)
        self.page = page
        self.output_path = output_path

    def run(self):
        # 执行截图
        pass

# ❌ 错误：使用 ThreadPoolExecutor 启动 Thread
from concurrent.futures import ThreadPoolExecutor  # 禁止用于 Thread
```

✅ **ColorPrint 使用**
```python
# ✅ 正确：使用 ColorPrint 输出
from pycore.pyfoundations.color_print import ColorPrint

ColorPrint.green('[ImageUtils] Image loaded successfully')
ColorPrint.red('[ImageUtils] Failed to load image')
ColorPrint.blue('[ImageUtils] Processing image...')
ColorPrint.yellow('[ImageUtils] Warning: Image quality may be degraded')

# ❌ 错误：使用 print
print("Image loaded")  # 禁止
```

---

## 9. 测试计划

### 9.1 单元测试

**文件**: `pycore/pyctl/pybrowserauto/tests/test_image_utils.py`

```python
def test_load_image_from_local():
    """测试从本地加载图片"""
    img = ImageUtils.load_image('/path/to/test.png')
    assert img is not None
    assert img.size == (800, 600)

def test_load_image_from_url():
    """测试从 URL 加载图片"""
    img = ImageUtils.load_image('https://example.com/image.jpg')
    assert img is not None

def test_merge_images_horizontal():
    """测试水平合并"""
    img1 = Image.new('RGB', (100, 100), 'red')
    img2 = Image.new('RGB', (100, 100), 'blue')
    merged = ImageUtils.merge_images_horizontal([img1, img2], spacing=10)
    assert merged.size == (210, 100)  # 100 + 10 + 100

def test_merge_images_vertical():
    """测试垂直合并"""
    img1 = Image.new('RGB', (100, 100), 'red')
    img2 = Image.new('RGB', (100, 100), 'blue')
    merged = ImageUtils.merge_images_vertical([img1, img2], spacing=5)
    assert merged.size == (100, 205)  # 100 + 5 + 100
```

### 9.2 集成测试

**文件**: `pycore/pyctl/pybrowserauto/tests/test_automation_controller.py`

```python
def test_navigate_screenshot_merge():
    """测试完整流程"""
    controller = AutomationController()
    controller.initialize(browser_type='chrome', headless=True)

    result = controller.navigate_screenshot_merge(
        url='https://example.com',
        reference_image='/test/reference.png',
        output_path='/test/output/merged.png',
        merge_mode='horizontal'
    )

    assert result['success'] == True
    assert os.path.exists(result['merged_path'])

    controller.cleanup()
```

---

## 10. 性能优化

### 10.1 图片处理优化

```python
# 使用内存流避免频繁磁盘 I/O
from io import BytesIO

def load_image_from_bytes(img_bytes: bytes) -> Image:
    """从字节流加载图片"""
    Image = get_third_package_PIL_Image()
    return Image.open(BytesIO(img_bytes))
```

### 10.2 批量处理优化

```python
# 使用线程池并发处理
from concurrent.futures import ThreadPoolExecutor

def batch_process_images(image_sources: List[str], max_workers: int = 5):
    """批量处理图片"""
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(process_single_image, src) for src in image_sources]
        results = [f.result() for f in futures]
    return results
```

---

## 11. 后续增强

### 11.1 短期（1-2 周）
- ✅ ImageUtils 基础功能
- ✅ ScreenshotManager 基础功能
- ✅ AutomationController 核心流程
- ✅ CLI 扩展

### 11.2 中期（1 个月）
- 🔧 图片对比功能（像素级差异）
- 🔧 截图缓存机制
- 🔧 并发截图优化
- 🔧 更多图片合并布局（叠加、蒙版等）

### 11.3 长期（3 个月）
- 🔧 视频录制功能
- 🔧 页面性能监控
- 🔧 A/B 测试对比
- 🔧 可视化回归测试报告

---

## 12. 总结

### 12.1 重命名总结

```
document_offline → pybrowserauto
offline_manager → pybrowserauto_manager
```

### 12.2 新增功能总结

| 模块 | 位置 | 功能 |
|------|------|------|
| **ImageUtils** | `pycore/pyutils/pybrowser/utils/image_utils.py` | 图片加载、合并、保存、对比 |
| **ScreenshotManager** | `pycore/pyctl/pybrowserauto/automation/screenshot_manager.py` | 截图管理、批量截图、截图合并 |
| **PageSwitcher** | `pycore/pyctl/pybrowserauto/automation/page_switcher.py` | 智能页面切换 |
| **AutomationController** | `pycore/pyctl/pybrowserauto/controller/automation_controller.py` | 自动化流程编排 |
| **ImageProcessor** | `pycore/pyctl/pybrowserauto/processor/image_processor.py` | 图片批量处理 |

### 12.3 复用总结

**PyBrowser 复用组件**:
- ✅ `StandardPage.screenshot()` - 基础截图
- ✅ `ScreenshotPlugin.take_fullpage_screenshot()` - 完整页面截图
- ✅ `EnhancedPage.switch_to_page_by_*()` - 页面切换
- ✅ `ChromeBrowser.switch_to_tab()` - 标签页切换
- ✅ `PageUtils.wait_for_load()` - 等待页面加载
- ✅ `IBrowser.get_pages()` - 获取所有页面

**新增依赖**:
- 🆕 `Pillow` (PIL) - 图片处理

---

**设计完成日期**: 2025-11-17
**版本**: v2.0.0
**状态**: ✅ 设计完成，待实施
