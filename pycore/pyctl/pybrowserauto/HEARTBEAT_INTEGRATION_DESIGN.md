# DocumentOffline心跳任务集成设计

## 1. 概述

DocumentOffline将使用pyheartbeat全局任务调度系统来管理异步下载、处理和报告任务。这样设计可以：

- ✅ 异步处理大量URL下载任务
- ✅ 统一任务优先级管理
- ✅ 内置重试机制
- ✅ 进度追踪和回调通知
- ✅ 与其他模块共享全局队列

## 2. 任务类型设计

### 2.1 任务类型定义

```python
# DocumentOffline定义3种任务类型
TASK_TYPES = {
    'document.download': 'URL下载任务',
    'document.process': '内容处理任务（HTML/CSS/资源）',
    'document.report': '报告生成任务'
}
```

### 2.2 Download Task (document.download)

**用途**: 使用fetcher下载单个URL

**Task Data格式**:
```python
{
    'url': str,                    # 要下载的URL
    'fetcher_type': str,           # 'http' | 'browser' | 'iframe' | 'tampermonkey'
    'fetcher_options': Dict,       # Fetcher选项
    'depth': int,                  # 当前深度（用于max_depth控制）
    'crawl_session_id': str,       # 爬取会话ID（用于批量下载）
    'save_path': str,              # 保存路径
    'extract_resources': bool      # 是否提取资源（CSS/JS/图片等）
}
```

**Task Metadata（结果存储）**:
```python
{
    'content': str,                # 下载的内容
    'final_url': str,              # 最终URL（重定向后）
    'content_type': str,           # Content-Type
    'status': int,                 # HTTP状态码
    'resources': List[str],        # 提取的资源URL列表（如果extract_resources=True）
    'links': List[str]             # 提取的链接URL列表（用于递归下载）
}
```

### 2.3 Process Task (document.process)

**用途**: 处理HTML/CSS内容，重写URL，下载资源

**Task Data格式**:
```python
{
    'url': str,                    # 页面URL
    'content': str,                # 页面内容
    'content_type': str,           # Content-Type
    'save_path': str,              # 保存路径
    'crawl_session_id': str,       # 爬取会话ID
    'process_options': Dict        # 处理选项
        {
            'download_resources': bool,  # 是否下载资源
            'rewrite_urls': bool,        # 是否重写URL
            'process_css': bool          # 是否处理CSS中的URL
        }
}
```

**Task Metadata（结果存储）**:
```python
{
    'processed_content': str,      # 处理后的内容
    'saved_path': str,             # 实际保存路径
    'resource_count': int,         # 下载的资源数量
    'failed_resources': List[str]  # 下载失败的资源URL
}
```

### 2.4 Report Task (document.report)

**用途**: 生成sitemap、mapsite、失败URL报告

**Task Data格式**:
```python
{
    'crawl_session_id': str,       # 爬取会话ID
    'report_type': str,            # 'sitemap' | 'mapsite' | 'failed_urls' | 'stats'
    'output_path': str,            # 报告输出路径
    'report_options': Dict         # 报告选项
}
```

**Task Metadata（结果存储）**:
```python
{
    'report_path': str,            # 生成的报告路径
    'report_size': int,            # 报告文件大小
    'item_count': int              # 报告包含的条目数
}
```

## 3. Handler实现

### 3.1 目录结构

```
pyctl/document_offline/
└── heartbeat/
    ├── __init__.py
    ├── download_handler.py      # DownloadTaskHandler
    ├── process_handler.py       # ProcessTaskHandler
    └── report_handler.py        # ReportTaskHandler
```

### 3.2 DownloadTaskHandler实现

```python
# pyctl/document_offline/heartbeat/download_handler.py

from pycore.pyheartbeat import TaskHandler
from pycore.pyfoundations import Task, ColorPrint
from pycore.pyutils.pybrowser.fetchers import (
    HTTPFetcher, BrowserFetcher, IframeFetcher, TampermonkeyFetcher
)

class DownloadTaskHandler(TaskHandler):
    """
    URL下载任务处理器

    负责使用不同的fetcher下载URL内容
    """

    def __init__(self):
        super().__init__()
        self._fetchers = {}  # 缓存fetcher实例

    def handle(self, task: Task) -> bool:
        url = task.task_data.get('url')
        fetcher_type = task.task_data.get('fetcher_type', 'http')
        fetcher_options = task.task_data.get('fetcher_options', {})

        if not url:
            ColorPrint.red(f"[DownloadHandler] Missing URL in task {task.task_id}")
            return False

        ColorPrint.green(f"[DownloadHandler] Downloading {url} using {fetcher_type}")

        # 获取或创建fetcher
        fetcher = self._get_fetcher(fetcher_type)
        if not fetcher:
            return False

        # 确保fetcher已初始化
        if not fetcher.is_initialized:
            fetcher.initialize(fetcher_options)

        # 执行下载
        result = fetcher.fetch(url, fetcher_options)

        if not result or not result.success:
            ColorPrint.red(f"[DownloadHandler] Download failed: {url}")
            return False

        # 保存结果到metadata
        task.metadata['content'] = result.content
        task.metadata['final_url'] = result.url
        task.metadata['content_type'] = result.content_type
        task.metadata['status'] = result.status

        # 如果需要，提取资源和链接
        if task.task_data.get('extract_resources'):
            resources, links = self._extract_resources_and_links(
                result.content,
                result.url
            )
            task.metadata['resources'] = resources
            task.metadata['links'] = links

        ColorPrint.green(f"[DownloadHandler] Downloaded {url} ({len(result.content)} bytes)")
        return True

    def _get_fetcher(self, fetcher_type: str):
        """获取或创建fetcher"""
        if fetcher_type not in self._fetchers:
            if fetcher_type == 'http':
                self._fetchers[fetcher_type] = HTTPFetcher()
            elif fetcher_type == 'browser':
                self._fetchers[fetcher_type] = BrowserFetcher()
            elif fetcher_type == 'iframe':
                self._fetchers[fetcher_type] = IframeFetcher()
            elif fetcher_type == 'tampermonkey':
                self._fetchers[fetcher_type] = TampermonkeyFetcher()
            else:
                ColorPrint.red(f"[DownloadHandler] Unknown fetcher type: {fetcher_type}")
                return None

        return self._fetchers[fetcher_type]

    def _extract_resources_and_links(self, content: str, base_url: str):
        """提取资源和链接"""
        from pycore.pyfoundations.third_party import get_third_package_BeautifulSoup

        BeautifulSoup = get_third_package_BeautifulSoup()
        soup = BeautifulSoup(content, 'html.parser')

        # 提取资源
        resources = []
        for tag in soup.find_all(['img', 'script', 'link', 'video', 'audio']):
            src = tag.get('src') or tag.get('href')
            if src:
                resources.append(src)

        # 提取链接
        links = []
        for a in soup.find_all('a', href=True):
            links.append(a['href'])

        return resources, links

    def on_error(self, task: Task, error: Exception):
        """错误处理"""
        url = task.task_data.get('url', 'unknown')
        ColorPrint.red(f"[DownloadHandler] Error downloading {url}: {error}")
```

### 3.3 ProcessTaskHandler实现（简化版）

```python
# pyctl/document_offline/heartbeat/process_handler.py

from pycore.pyheartbeat import TaskHandler
from pycore.pyfoundations import Task, ColorPrint

class ProcessTaskHandler(TaskHandler):
    """
    内容处理任务处理器

    负责处理HTML/CSS内容，重写URL，下载资源
    """

    def handle(self, task: Task) -> bool:
        url = task.task_data.get('url')
        content = task.task_data.get('content')
        save_path = task.task_data.get('save_path')

        if not content or not save_path:
            return False

        ColorPrint.green(f"[ProcessHandler] Processing {url}")

        # TODO: 实现处理逻辑
        # 1. 重写URL
        # 2. 下载资源
        # 3. 保存到本地

        task.metadata['processed_content'] = content
        task.metadata['saved_path'] = save_path

        return True
```

### 3.4 ReportTaskHandler实现（简化版）

```python
# pyctl/document_offline/heartbeat/report_handler.py

from pycore.pyheartbeat import TaskHandler
from pycore.pyfoundations import Task, ColorPrint

class ReportTaskHandler(TaskHandler):
    """报告生成任务处理器"""

    def handle(self, task: Task) -> bool:
        report_type = task.task_data.get('report_type')
        output_path = task.task_data.get('output_path')

        ColorPrint.green(f"[ReportHandler] Generating {report_type} report")

        # TODO: 实现报告生成逻辑

        task.metadata['report_path'] = output_path
        return True
```

## 4. 使用方式

### 4.1 注册Handlers

```python
# pyctl/document_offline/__init__.py

from pycore.pyctl.document_offline.offline_manager import offline_manager

_heartbeat_registered = False

def register_heartbeat_handlers():
    """注册DocumentOffline的heartbeat handlers"""
    global _heartbeat_registered

    if _heartbeat_registered:
        return

    from pycore.pyheartbeat import get_global_scheduler
    from pycore.pyctl.document_offline.heartbeat import (
        DownloadTaskHandler,
        ProcessTaskHandler,
        ReportTaskHandler
    )
    from pycore.pyfoundations import ColorPrint

    scheduler = get_global_scheduler()
    scheduler.register_handler('document.download', DownloadTaskHandler())
    scheduler.register_handler('document.process', ProcessTaskHandler())
    scheduler.register_handler('document.report', ReportTaskHandler())

    _heartbeat_registered = True
    ColorPrint.green("[DocumentOffline] Heartbeat handlers registered")

__all__ = ['offline_manager', 'register_heartbeat_handlers']
```

### 4.2 CrawlController集成

```python
# pyctl/document_offline/controller/crawl_controller.py

import threading
from pycore.pyheartbeat import get_global_scheduler
from pycore.pyfoundations import Task, TaskPriority, ColorPrint

class CrawlController(threading.Thread):
    """
    爬取控制器

    使用heartbeat进行异步下载和处理
    """

    def __init__(self, config: dict):
        super().__init__(name='CrawlController', daemon=True)
        self.config = config
        self.scheduler = get_global_scheduler()
        self.crawl_session_id = str(uuid.uuid4())
        self.pending_tasks = set()
        self.completed_tasks = set()

    def download_url(self, url: str, depth: int = 0):
        """提交URL下载任务"""

        def on_complete(task: Task):
            """下载完成回调"""
            self.completed_tasks.add(task.task_id)
            self.pending_tasks.discard(task.task_id)

            ColorPrint.green(f"[Controller] Download completed: {task.task_data['url']}")

            # 提取链接并递归下载
            links = task.metadata.get('links', [])
            if depth < self.config.get('max_depth', 10):
                for link in links[:self.config.get('max_links', 100)]:
                    self.download_url(link, depth + 1)

            # 提交处理任务
            self.process_content(
                url=task.task_data['url'],
                content=task.metadata.get('content'),
                save_path=f"downloads/{crawl_session_id}/page_{len(completed_tasks)}.html"
            )

        def on_error(task: Task):
            """下载失败回调"""
            self.pending_tasks.discard(task.task_id)
            ColorPrint.red(f"[Controller] Download failed: {task.task_data['url']}")

        # 提交下载任务
        task_id = self.scheduler.add_task(
            task_type='document.download',
            task_data={
                'url': url,
                'fetcher_type': self.config.get('fetcher_type', 'http'),
                'fetcher_options': self.config.get('fetcher_options', {}),
                'depth': depth,
                'crawl_session_id': self.crawl_session_id,
                'extract_resources': True
            },
            priority=TaskPriority.HIGH if depth == 0 else TaskPriority.NORMAL,
            callback=on_complete,
            error_callback=on_error,
            max_retries=3
        )

        self.pending_tasks.add(task_id)

    def process_content(self, url: str, content: str, save_path: str):
        """提交内容处理任务"""

        def on_complete(task: Task):
            ColorPrint.green(f"[Controller] Process completed: {task.task_data['url']}")

        task_id = self.scheduler.add_task(
            task_type='document.process',
            task_data={
                'url': url,
                'content': content,
                'save_path': save_path,
                'crawl_session_id': self.crawl_session_id,
                'process_options': {
                    'download_resources': True,
                    'rewrite_urls': True,
                    'process_css': True
                }
            },
            priority=TaskPriority.NORMAL,
            callback=on_complete,
            max_retries=1
        )

    def run(self):
        """主循环：等待所有任务完成"""
        ColorPrint.green(f"[Controller] Starting crawl session: {self.crawl_session_id}")

        # 提交初始URL
        initial_url = self.config.get('url')
        self.download_url(initial_url, depth=0)

        # 等待所有任务完成
        while len(self.pending_tasks) > 0:
            time.sleep(1)

        ColorPrint.green(f"[Controller] Crawl session completed: {len(self.completed_tasks)} tasks")

        # 生成报告
        self.generate_report()

    def generate_report(self):
        """生成报告"""
        self.scheduler.add_task(
            task_type='document.report',
            task_data={
                'crawl_session_id': self.crawl_session_id,
                'report_type': 'stats',
                'output_path': f"downloads/{self.crawl_session_id}/report.json"
            },
            priority=TaskPriority.LOW
        )
```

### 4.3 应用启动

```python
# pyapps/document_offline/main.py

from pycore.pyctl.document_offline import register_heartbeat_handlers
from pycore.pyheartbeat import get_global_scheduler

def start():
    """启动DocumentOffline应用"""

    # 1. 启动全局scheduler
    scheduler = get_global_scheduler()
    if not scheduler.is_running():
        scheduler.start()

    # 2. 注册DocumentOffline handlers
    register_heartbeat_handlers()

    # 3. 创建并启动CrawlController
    from pycore.pyctl.document_offline.controller import CrawlController

    config = {
        'url': 'https://example.com',
        'fetcher_type': 'http',
        'max_depth': 3,
        'max_links': 50
    }

    controller = CrawlController(config)
    controller.start()
    controller.join()  # 等待完成

    ColorPrint.green("[App] DocumentOffline completed")
```

## 5. 优势分析

### 5.1 与直接使用Fetcher对比

**直接使用（同步）**:
```python
# 缺点：阻塞，无法并发，无重试，无优先级
fetcher = HTTPFetcher()
fetcher.initialize()
for url in urls:
    result = fetcher.fetch(url)  # 阻塞
    process(result)
fetcher.cleanup()
```

**使用Heartbeat（异步）**:
```python
# 优点：异步，并发，自动重试，优先级管理，进度追踪
scheduler = get_global_scheduler()
for url in urls:
    scheduler.add_task(
        'document.download',
        {'url': url},
        callback=lambda task: process(task.metadata)
    )
# 非阻塞，继续执行其他逻辑
```

### 5.2 性能提升

| 场景 | 直接使用 | 使用Heartbeat | 提升 |
|------|---------|--------------|------|
| 下载100个URL | 100 * 平均时间 | 理论上并发处理 | ~10-100x |
| 失败重试 | 手动实现 | 自动重试3次 | 减少代码 |
| 优先级 | 无 | 4级优先级 | 灵活调度 |
| 进度追踪 | 手动实现 | 内置统计 | 减少代码 |

## 6. 总结

✅ **使用Heartbeat的好处**:
- 异步非阻塞执行
- 自动重试机制
- 优先级管理
- 回调通知
- 统一任务队列
- 内置统计监控

✅ **实现清晰**:
- 3个Handler: Download, Process, Report
- 职责分离：Controller编排，Handler执行
- 使用PyBrowser fetchers，无重复代码

✅ **扩展性强**:
- 轻松添加新任务类型
- Handler可独立测试
- 与其他模块共享全局队列
