#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
下载NSRCC网站的所有页面和图片，并整理成HTML文档
"""

import os
import re
import json
from urllib.parse import urljoin, urlparse, unquote
from pathlib import Path
import requests
from bs4 import BeautifulSoup
import time

class NSRCCDownloader:
    def __init__(self, base_url="https://www.nsrcc.com.sg/"):
        self.base_url = base_url
        self.domain = urlparse(base_url).netloc
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        
        # 创建输出目录 - 使用.tmp/url/目录
        tmp_dir = Path(".tmp")
        url_dir = tmp_dir / "url"
        self.output_dir = url_dir
        self.pages_dir = self.output_dir / "pages"
        self.images_dir = self.output_dir / "images"
        self.pages_dir.mkdir(parents=True, exist_ok=True)
        self.images_dir.mkdir(parents=True, exist_ok=True)
        
        # 跟踪已访问的URL
        self.visited_urls = set()
        self.downloaded_images = {}
        self.downloaded_pages = {}
        self.failed_urls = set()
        
    def is_same_domain(self, url):
        """检查URL是否属于同一域名"""
        parsed = urlparse(url)
        return parsed.netloc == self.domain or parsed.netloc == ""
    
    def normalize_url(self, url):
        """规范化URL"""
        if not url:
            return None
        if url.startswith('//'):
            url = 'https:' + url
        elif url.startswith('/'):
            url = self.base_url.rstrip('/') + url
        elif not url.startswith('http'):
            url = urljoin(self.base_url, url)
        return url.rstrip('/')
    
    def extract_links(self, html_content, base_url):
        """从HTML中提取所有链接"""
        soup = BeautifulSoup(html_content, 'html.parser')
        links = set()
        
        # 提取所有a标签的href
        for tag in soup.find_all('a', href=True):
            href = tag['href']
            url = self.normalize_url(href)
            if url and self.is_same_domain(url) and url not in self.visited_urls:
                # 排除外部链接和特殊链接
                if not url.startswith('mailto:') and not url.startswith('javascript:'):
                    links.add(url)
        
        return links
    
    def extract_images(self, html_content, base_url):
        """从HTML中提取所有图片"""
        soup = BeautifulSoup(html_content, 'html.parser')
        images = set()
        
        # 提取img标签的src
        for tag in soup.find_all('img', src=True):
            src = tag['src']
            url = self.normalize_url(src)
            if url and self.is_same_domain(url):
                images.add(url)
        
        # 提取CSS背景图片
        for tag in soup.find_all(style=True):
            style = tag['style']
            # 简单的正则匹配url(...)
            urls = re.findall(r'url\(["\']?([^"\']+)["\']?\)', style)
            for url in urls:
                url = self.normalize_url(url)
                if url and self.is_same_domain(url):
                    images.add(url)
        
        return images
    
    def download_file(self, url, save_path):
        """下载文件"""
        try:
            response = self.session.get(url, timeout=30, stream=True)
            response.raise_for_status()
            
            with open(save_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            return True
        except Exception as e:
            print(f"Download failed {url}: {e}")
            return False
    
    def get_filename_from_url(self, url, default_ext='.html'):
        """从URL生成文件名"""
        parsed = urlparse(url)
        path = unquote(parsed.path)
        
        if path.endswith('/') or not path.split('/')[-1]:
            filename = 'index.html'
        else:
            filename = path.split('/')[-1]
            if '.' not in filename:
                filename += default_ext
        
        # 清理文件名
        filename = re.sub(r'[<>:"|?*]', '_', filename)
        return filename
    
    def download_image(self, url):
        """下载图片"""
        if url in self.downloaded_images:
            return self.downloaded_images[url]
        
        parsed = urlparse(url)
        ext = os.path.splitext(parsed.path)[1] or '.jpg'
        filename = f"img_{len(self.downloaded_images)}{ext}"
        save_path = self.images_dir / filename
        
        if self.download_file(url, save_path):
            self.downloaded_images[url] = filename
            return filename
        else:
            self.failed_urls.add(url)
            return None
    
    def download_page(self, url):
        """下载页面"""
        if url in self.visited_urls:
            return self.downloaded_pages.get(url)
        
        self.visited_urls.add(url)
        print(f"Downloading page: {url}")
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            html_content = response.text
            
            # 保存原始HTML
            filename = self.get_filename_from_url(url)
            save_path = self.pages_dir / filename
            with open(save_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            self.downloaded_pages[url] = filename
            
            # 提取并下载图片
            images = self.extract_images(html_content, url)
            for img_url in images:
                self.download_image(img_url)
                time.sleep(0.1)  # 避免请求过快
            
            # 提取链接
            links = self.extract_links(html_content, url)
            
            return {
                'filename': filename,
                'content': html_content,
                'links': links,
                'images': images
            }
        except Exception as e:
            print(f"Failed to download page {url}: {e}")
            self.failed_urls.add(url)
            return None
    
    def crawl_website(self, max_pages=100):
        """爬取网站"""
        queue = [self.base_url]
        page_count = 0
        
        while queue and page_count < max_pages:
            url = queue.pop(0)
            
            if url in self.visited_urls:
                continue
            
            result = self.download_page(url)
            if result:
                page_count += 1
                # 添加新链接到队列
                for link in result['links']:
                    if link not in self.visited_urls and link not in queue:
                        queue.append(link)
                
                time.sleep(0.5)  # 避免请求过快
        
        print(f"\nTotal pages downloaded: {page_count}")
        print(f"Total images downloaded: {len(self.downloaded_images)}")
    
    def create_index_html(self):
        """创建索引HTML文档"""
        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NSRCC 网站完整下载 - 索引</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        h1 {{
            color: #333;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 10px;
        }}
        .stats {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .pages-list {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .pages-list h2 {{
            color: #0066cc;
            margin-top: 0;
        }}
        .page-item {{
            padding: 10px;
            margin: 5px 0;
            background: #f9f9f9;
            border-left: 3px solid #0066cc;
        }}
        .page-item a {{
            color: #0066cc;
            text-decoration: none;
            font-weight: bold;
        }}
        .page-item a:hover {{
            text-decoration: underline;
        }}
        .images-list {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .images-list h2 {{
            color: #0066cc;
            margin-top: 0;
        }}
        .image-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }}
        .image-item {{
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
            background: #f9f9f9;
        }}
        .image-item img {{
            width: 100%;
            height: 150px;
            object-fit: cover;
        }}
        .image-item p {{
            padding: 5px;
            margin: 0;
            font-size: 12px;
            text-align: center;
            word-break: break-all;
        }}
        .failed {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .failed h2 {{
            color: #cc0000;
            margin-top: 0;
        }}
        .failed-item {{
            padding: 5px;
            color: #666;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <h1>NSRCC 网站完整下载</h1>
    
    <div class="stats">
        <h2>统计信息</h2>
        <p><strong>下载的页面数:</strong> {len(self.downloaded_pages)}</p>
        <p><strong>下载的图片数:</strong> {len(self.downloaded_images)}</p>
        <p><strong>失败的URL数:</strong> {len(self.failed_urls)}</p>
        <p><strong>原始网站:</strong> <a href="{self.base_url}" target="_blank">{self.base_url}</a></p>
    </div>
    
    <div class="pages-list">
        <h2>下载的页面列表</h2>
"""
        
        for url, filename in sorted(self.downloaded_pages.items()):
            html_content += f"""
        <div class="page-item">
            <a href="pages/{filename}" target="_blank">{url}</a>
        </div>
"""
        
        html_content += """
    </div>
    
    <div class="images-list">
        <h2>下载的图片列表</h2>
        <div class="image-grid">
"""
        
        for url, filename in sorted(self.downloaded_images.items()):
            html_content += f"""
            <div class="image-item">
                <img src="images/{filename}" alt="{filename}" onerror="this.style.display='none'">
                <p><a href="images/{filename}" target="_blank">{filename}</a></p>
                <p style="font-size: 10px; color: #999;">{url[:50]}...</p>
            </div>
"""
        
        html_content += """
        </div>
    </div>
"""
        
        if self.failed_urls:
            html_content += """
    <div class="failed">
        <h2>失败的URL</h2>
"""
            for url in sorted(self.failed_urls):
                html_content += f'        <div class="failed-item">{url}</div>\n'
            html_content += "    </div>\n"
        
        html_content += """
</body>
</html>
"""
        
        index_path = self.output_dir / "index.html"
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"\nIndex file created: {index_path}")

def main():
    import sys
    import io
    # 设置标准输出为UTF-8
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    print("Starting to download NSRCC website...")
    downloader = NSRCCDownloader()
    downloader.crawl_website(max_pages=50)  # 限制最多50页
    downloader.create_index_html()
    print("\nDownload completed!")

if __name__ == "__main__":
    main()

