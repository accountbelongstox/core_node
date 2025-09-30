#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
优化的屏幕截图工具类
基于性能测试结果的最佳实践实现
"""

import os
import sys
import time
from PIL import Image, ImageGrab
import win32api
import win32con

# 添加项目路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(current_dir)
ncore_path = os.path.join(os.path.dirname(os.path.dirname(project_dir)), "ncore")
sys.path.insert(0, ncore_path)

from pytools.pyfoundations.color_print import ColorPrint


class OptimizedScreenshot:
    """优化的屏幕截图工具类"""
    
    def __init__(self, target_resolution='720p'):
        """
        初始化截图工具
        
        Args:
            target_resolution (str): 目标分辨率 '480p', '720p', 'full'
        """
        self.target_resolution = target_resolution
        
        # 获取屏幕信息
        self.screen_width = win32api.GetSystemMetrics(win32con.SM_CXSCREEN)
        self.screen_height = win32api.GetSystemMetrics(win32con.SM_CYSCREEN)
        
        # 计算缩放比例
        self._calculate_scale()
        
        ColorPrint.blue(f"[OptimizedScreenshot] Initialized with {target_resolution} resolution")
        ColorPrint.blue(f"[OptimizedScreenshot] Screen: {self.screen_width}x{self.screen_height}")
        if target_resolution != 'full':
            ColorPrint.blue(f"[OptimizedScreenshot] Target: {self.new_width}x{self.new_height}")
    
    def _calculate_scale(self):
        """计算缩放比例"""
        if self.target_resolution == '480p':
            target_width, target_height = 854, 480
        elif self.target_resolution == '720p':
            target_width, target_height = 1280, 720
        else:  # full
            target_width, target_height = self.screen_width, self.screen_height
        
        scale_x = target_width / self.screen_width
        scale_y = target_height / self.screen_height
        self.scale = min(scale_x, scale_y)  # 保持宽高比
        
        self.new_width = int(self.screen_width * self.scale)
        self.new_height = int(self.screen_height * self.scale)
    
    def capture(self, save_path=None):
        """
        捕获并优化截图
        
        Args:
            save_path (str, optional): 保存路径
            
        Returns:
            PIL.Image: 截图图像
        """
        start_time = time.time()
        
        try:
            # 捕获全屏
            img = ImageGrab.grab()
            
            # 如果需要缩放
            if self.target_resolution != 'full':
                img = img.resize((self.new_width, self.new_height), 
                               Image.Resampling.LANCZOS)
            
            # 保存图像
            if save_path:
                img.save(save_path)
                ColorPrint.green(f"[OptimizedScreenshot] Image saved to: {save_path}")
            
            end_time = time.time()
            duration = (end_time - start_time) * 1000
            ColorPrint.blue(f"[OptimizedScreenshot] Capture completed in {duration:.2f}ms")
            
            return img
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Screenshot capture failed: {e}")
            return None
    
    def capture_fast(self, save_path=None):
        """
        快速捕获（480p）
        
        Args:
            save_path (str, optional): 保存路径
            
        Returns:
            PIL.Image: 截图图像
        """
        start_time = time.time()
        
        try:
            # 捕获全屏
            img = ImageGrab.grab()
            
            # 缩放到480p
            resized_img = img.resize((768, 480), Image.Resampling.LANCZOS)
            
            # 保存图像
            if save_path:
                resized_img.save(save_path)
                ColorPrint.green(f"[OptimizedScreenshot] Fast image saved to: {save_path}")
            
            end_time = time.time()
            duration = (end_time - start_time) * 1000
            ColorPrint.blue(f"[OptimizedScreenshot] Fast capture completed in {duration:.2f}ms")
            
            return resized_img
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Fast screenshot capture failed: {e}")
            return None
    
    def capture_balanced(self, save_path=None):
        """
        平衡捕获（720p）
        
        Args:
            save_path (str, optional): 保存路径
            
        Returns:
            PIL.Image: 截图图像
        """
        start_time = time.time()
        
        try:
            # 捕获全屏
            img = ImageGrab.grab()
            
            # 缩放到720p
            resized_img = img.resize((1152, 720), Image.Resampling.LANCZOS)
            
            # 保存图像
            if save_path:
                resized_img.save(save_path)
                ColorPrint.green(f"[OptimizedScreenshot] Balanced image saved to: {save_path}")
            
            end_time = time.time()
            duration = (end_time - start_time) * 1000
            ColorPrint.blue(f"[OptimizedScreenshot] Balanced capture completed in {duration:.2f}ms")
            
            return resized_img
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Balanced screenshot capture failed: {e}")
            return None
    
    def capture_full(self, save_path=None):
        """
        全分辨率捕获
        
        Args:
            save_path (str, optional): 保存路径
            
        Returns:
            PIL.Image: 截图图像
        """
        start_time = time.time()
        
        try:
            # 捕获全屏
            img = ImageGrab.grab()
            
            # 保存图像
            if save_path:
                img.save(save_path)
                ColorPrint.green(f"[OptimizedScreenshot] Full image saved to: {save_path}")
            
            end_time = time.time()
            duration = (end_time - start_time) * 1000
            ColorPrint.blue(f"[OptimizedScreenshot] Full capture completed in {duration:.2f}ms")
            
            return img
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Full screenshot capture failed: {e}")
            return None
    
    def batch_capture(self, count=10, save_dir=None):
        """
        批量截图
        
        Args:
            count (int): 截图数量
            save_dir (str, optional): 保存目录
            
        Returns:
            list: 截图图像列表
        """
        ColorPrint.blue(f"[OptimizedScreenshot] Starting batch capture: {count} screenshots")
        
        images = []
        start_time = time.time()
        
        try:
            for i in range(count):
                img = self.capture()
                if img:
                    images.append(img)
                    
                    # 保存图像
                    if save_dir:
                        if not os.path.exists(save_dir):
                            os.makedirs(save_dir)
                        save_path = os.path.join(save_dir, f"screenshot_{i+1:03d}.png")
                        img.save(save_path)
                
                # 显示进度
                if (i + 1) % 10 == 0:
                    ColorPrint.blue(f"[OptimizedScreenshot] Progress: {i+1}/{count}")
            
            end_time = time.time()
            total_duration = end_time - start_time
            avg_duration = total_duration / count * 1000
            
            ColorPrint.green(f"[OptimizedScreenshot] Batch capture completed:")
            ColorPrint.green(f"  Total time: {total_duration:.3f}s")
            ColorPrint.green(f"  Average: {avg_duration:.2f}ms per screenshot")
            ColorPrint.green(f"  Success: {len(images)}/{count}")
            
            return images
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Batch capture failed: {e}")
            return images
    
    def performance_test(self, count=10):
        """
        性能测试
        
        Args:
            count (int): 测试次数
            
        Returns:
            dict: 性能测试结果
        """
        ColorPrint.blue(f"[OptimizedScreenshot] Starting performance test: {count} screenshots")
        
        results = {}
        
        # 测试不同方法
        methods = [
            ('Fast (480p)', self.capture_fast),
            ('Balanced (720p)', self.capture_balanced),
            ('Full Resolution', self.capture_full)
        ]
        
        for method_name, method_func in methods:
            ColorPrint.yellow(f"[OptimizedScreenshot] Testing {method_name}...")
            
            start_time = time.time()
            success_count = 0
            
            for i in range(count):
                try:
                    img = method_func()
                    if img:
                        success_count += 1
                except Exception as e:
                    ColorPrint.red(f"[ERROR] {method_name} failed: {e}")
            
            end_time = time.time()
            duration = end_time - start_time
            avg_duration = duration / count * 1000
            
            results[method_name] = {
                'total_time': duration,
                'avg_time': avg_duration,
                'success_count': success_count,
                'success_rate': success_count / count * 100
            }
            
            ColorPrint.green(f"[OptimizedScreenshot] {method_name}: {avg_duration:.2f}ms per screenshot")
        
        # 显示结果
        ColorPrint.blue("\n[OptimizedScreenshot] Performance Test Results:")
        ColorPrint.blue("=" * 60)
        
        sorted_results = sorted(results.items(), key=lambda x: x[1]['avg_time'])
        
        for i, (method_name, result) in enumerate(sorted_results, 1):
            ColorPrint.green(f"{i}. {method_name}: {result['avg_time']:.2f}ms per screenshot")
            ColorPrint.blue(f"   Success rate: {result['success_rate']:.1f}%")
        
        return results


def main():
    """主函数 - 演示用法"""
    ColorPrint.blue("=== Optimized Screenshot Tool Demo ===")
    
    # 创建截图工具
    screenshot = OptimizedScreenshot('720p')
    
    # 设置输出目录
    username = os.getenv('USERNAME', '用户名')
    output_dir = f"C:\\Users\\{username}\\.core_node\\.d3check\\screen_test"
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 演示不同方法
    ColorPrint.yellow("\n--- Demo: Single Screenshots ---")
    
    # 快速截图
    fast_img = screenshot.capture_fast(os.path.join(output_dir, "demo_fast.png"))
    
    # 平衡截图
    balanced_img = screenshot.capture_balanced(os.path.join(output_dir, "demo_balanced.png"))
    
    # 全分辨率截图
    full_img = screenshot.capture_full(os.path.join(output_dir, "demo_full.png"))
    
    # 性能测试
    ColorPrint.yellow("\n--- Demo: Performance Test ---")
    results = screenshot.performance_test(5)
    
    ColorPrint.green("\n[COMPLETE] Demo completed successfully!")
    ColorPrint.green(f"Check results in: {output_dir}")


if __name__ == "__main__":
    main()
