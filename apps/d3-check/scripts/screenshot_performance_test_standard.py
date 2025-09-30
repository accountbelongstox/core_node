#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
屏幕截图性能测试脚本 - 使用标准库
测试多种截图方法的性能，包括优化版本
"""

import os
import sys
import time
import numpy as np
from PIL import Image, ImageGrab
import win32gui
import win32ui
import win32con
import win32api
from ctypes import windll
import ctypes
from ctypes import wintypes

# 添加项目路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(current_dir)
ncore_path = os.path.join(os.path.dirname(os.path.dirname(project_dir)), "ncore")
sys.path.insert(0, ncore_path)

from pytools.pyfoundations.color_print import ColorPrint


class ScreenshotPerformanceTest:
    """屏幕截图性能测试类 - 使用标准库"""
    
    def __init__(self):
        """初始化测试环境"""
        self.test_count = 50  # 减少测试次数，因为标准库可能较慢
        
        # 使用用户指定的目录
        username = os.getenv('USERNAME', '用户名')
        self.output_dir = f"C:\\Users\\{username}\\.core_node\\.d3check\\screen_test"
        
        # 创建输出目录
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
            ColorPrint.green(f"[INIT] Created output directory: {self.output_dir}")
        else:
            ColorPrint.blue(f"[INIT] Using existing directory: {self.output_dir}")
        
        # 获取屏幕信息
        self.screen_width = win32api.GetSystemMetrics(win32con.SM_CXSCREEN)
        self.screen_height = win32api.GetSystemMetrics(win32con.SM_CYSCREEN)
        
        ColorPrint.blue(f"[INIT] Screen resolution: {self.screen_width}x{self.screen_height}")
        ColorPrint.blue(f"[INIT] Test count: {self.test_count} screenshots per method")
    
    def test_pil_imagegrab_basic(self):
        """测试 PIL ImageGrab 基础版本"""
        ColorPrint.yellow("\n=== Testing PIL ImageGrab Basic Version ===")
        
        try:
            start_time = time.time()
            
            for i in range(self.test_count):
                # 使用 PIL ImageGrab 截图
                img = ImageGrab.grab()
                
                # 保存前几张作为示例
                if i < 3:
                    img.save(os.path.join(self.output_dir, f"pil_imagegrab_basic_{i}.png"))
            
            end_time = time.time()
            duration = end_time - start_time
            
            ColorPrint.green(f"[PIL ImageGrab Basic] {self.test_count} screenshots completed in {duration:.3f} seconds")
            ColorPrint.green(f"[PIL ImageGrab Basic] Average: {duration/self.test_count*1000:.2f} ms per screenshot")
            
            return duration
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] PIL ImageGrab Basic test failed: {e}")
            return None
    
    def test_pil_imagegrab_optimized(self):
        """测试 PIL ImageGrab 优化版本（内存中缩放到720p）"""
        ColorPrint.yellow("\n=== Testing PIL ImageGrab Optimized Version (720p) ===")
        
        try:
            # 计算720p缩放比例
            target_width = 1280
            target_height = 720
            scale_x = target_width / self.screen_width
            scale_y = target_height / self.screen_height
            scale = min(scale_x, scale_y)  # 保持宽高比
            
            new_width = int(self.screen_width * scale)
            new_height = int(self.screen_height * scale)
            
            ColorPrint.blue(f"[PIL ImageGrab Optimized] Scaling to: {new_width}x{new_height}")
            
            start_time = time.time()
            
            for i in range(self.test_count):
                # 使用 PIL ImageGrab 截图
                img = ImageGrab.grab()
                
                # 在内存中缩放
                resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # 保存前几张作为示例
                if i < 3:
                    resized_img.save(os.path.join(self.output_dir, f"pil_imagegrab_optimized_{i}.png"))
            
            end_time = time.time()
            duration = end_time - start_time
            
            ColorPrint.green(f"[PIL ImageGrab Optimized] {self.test_count} screenshots completed in {duration:.3f} seconds")
            ColorPrint.green(f"[PIL ImageGrab Optimized] Average: {duration/self.test_count*1000:.2f} ms per screenshot")
            
            return duration
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] PIL ImageGrab Optimized test failed: {e}")
            return None
    
    def test_win32_bitblt_basic(self):
        """测试 Win32 BitBlt 基础版本"""
        ColorPrint.yellow("\n=== Testing Win32 BitBlt Basic Version ===")
        
        try:
            start_time = time.time()
            
            for i in range(self.test_count):
                # 获取桌面窗口句柄
                hdesktop = win32gui.GetDesktopWindow()
                
                # 获取桌面设备上下文
                hdc = win32gui.GetDC(hdesktop)
                
                # 创建内存设备上下文
                memdc = win32ui.CreateDCFromHandle(hdc)
                
                # 创建位图
                bmp = win32ui.CreateBitmap()
                bmp.CreateCompatibleBitmap(memdc, self.screen_width, self.screen_height)
                
                # 选择位图到内存设备上下文
                old_bmp = memdc.SelectObject(bmp)
                
                # 复制屏幕内容到位图
                memdc.BitBlt((0, 0), (self.screen_width, self.screen_height), 
                           hdc, (0, 0), win32con.SRCCOPY)
                
                # 保存前几张作为示例
                if i < 3:
                    bmp.SaveBitmapFile(memdc, os.path.join(self.output_dir, f"win32_bitblt_basic_{i}.bmp"))
                
                # 清理资源
                memdc.SelectObject(old_bmp)  # 恢复原始位图
                win32gui.DeleteObject(bmp.GetHandle())
                memdc.DeleteDC()
                win32gui.ReleaseDC(hdesktop, hdc)
            
            end_time = time.time()
            duration = end_time - start_time
            
            ColorPrint.green(f"[Win32 BitBlt Basic] {self.test_count} screenshots completed in {duration:.3f} seconds")
            ColorPrint.green(f"[Win32 BitBlt Basic] Average: {duration/self.test_count*1000:.2f} ms per screenshot")
            
            return duration
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Win32 BitBlt Basic test failed: {e}")
            return None
    
    def test_win32_bitblt_optimized(self):
        """测试 Win32 BitBlt 优化版本（内存中缩放到720p）"""
        ColorPrint.yellow("\n=== Testing Win32 BitBlt Optimized Version (720p) ===")
        
        try:
            # 计算720p缩放比例
            target_width = 1280
            target_height = 720
            scale_x = target_width / self.screen_width
            scale_y = target_height / self.screen_height
            scale = min(scale_x, scale_y)  # 保持宽高比
            
            new_width = int(self.screen_width * scale)
            new_height = int(self.screen_height * scale)
            
            ColorPrint.blue(f"[Win32 BitBlt Optimized] Scaling to: {new_width}x{new_height}")
            
            start_time = time.time()
            
            for i in range(self.test_count):
                # 获取桌面窗口句柄
                hdesktop = win32gui.GetDesktopWindow()
                
                # 获取桌面设备上下文
                hdc = win32gui.GetDC(hdesktop)
                
                # 创建内存设备上下文
                memdc = win32ui.CreateDCFromHandle(hdc)
                
                # 创建位图
                bmp = win32ui.CreateBitmap()
                bmp.CreateCompatibleBitmap(memdc, self.screen_width, self.screen_height)
                
                # 选择位图到内存设备上下文
                old_bmp = memdc.SelectObject(bmp)
                
                # 复制屏幕内容到位图
                memdc.BitBlt((0, 0), (self.screen_width, self.screen_height), 
                           hdc, (0, 0), win32con.SRCCOPY)
                
                # 转换为PIL Image并缩放
                bmpinfo = bmp.GetInfo()
                bmpstr = bmp.GetBitmapBits(True)
                img = Image.frombuffer('RGB', (bmpinfo['bmWidth'], bmpinfo['bmHeight']), 
                                     bmpstr, 'raw', 'BGRX', 0, 1)
                
                # 在内存中缩放
                resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # 保存前几张作为示例
                if i < 3:
                    resized_img.save(os.path.join(self.output_dir, f"win32_bitblt_optimized_{i}.png"))
                
                # 清理资源
                memdc.SelectObject(old_bmp)  # 恢复原始位图
                win32gui.DeleteObject(bmp.GetHandle())
                memdc.DeleteDC()
                win32gui.ReleaseDC(hdesktop, hdc)
            
            end_time = time.time()
            duration = end_time - start_time
            
            ColorPrint.green(f"[Win32 BitBlt Optimized] {self.test_count} screenshots completed in {duration:.3f} seconds")
            ColorPrint.green(f"[Win32 BitBlt Optimized] Average: {duration/self.test_count*1000:.2f} ms per screenshot")
            
            return duration
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Win32 BitBlt Optimized test failed: {e}")
            return None
    
    def test_win32_printwindow_basic(self):
        """测试 Win32 PrintWindow 基础版本"""
        ColorPrint.yellow("\n=== Testing Win32 PrintWindow Basic Version ===")
        
        try:
            start_time = time.time()
            
            for i in range(self.test_count):
                # 获取桌面窗口句柄
                hdesktop = win32gui.GetDesktopWindow()
                
                # 获取桌面设备上下文
                hdc = win32gui.GetDC(hdesktop)
                
                # 创建内存设备上下文
                memdc = win32ui.CreateDCFromHandle(hdc)
                
                # 创建位图
                bmp = win32ui.CreateBitmap()
                bmp.CreateCompatibleBitmap(memdc, self.screen_width, self.screen_height)
                
                # 选择位图到内存设备上下文
                old_bmp = memdc.SelectObject(bmp)
                
                # 使用 PrintWindow 复制窗口内容
                win32gui.PrintWindow(hdesktop, memdc.GetSafeHdc(), 3)
                
                # 保存前几张作为示例
                if i < 3:
                    bmp.SaveBitmapFile(memdc, os.path.join(self.output_dir, f"win32_printwindow_basic_{i}.bmp"))
                
                # 清理资源
                memdc.SelectObject(old_bmp)  # 恢复原始位图
                win32gui.DeleteObject(bmp.GetHandle())
                memdc.DeleteDC()
                win32gui.ReleaseDC(hdesktop, hdc)
            
            end_time = time.time()
            duration = end_time - start_time
            
            ColorPrint.green(f"[Win32 PrintWindow Basic] {self.test_count} screenshots completed in {duration:.3f} seconds")
            ColorPrint.green(f"[Win32 PrintWindow Basic] Average: {duration/self.test_count*1000:.2f} ms per screenshot")
            
            return duration
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Win32 PrintWindow Basic test failed: {e}")
            return None
    
    def test_win32_printwindow_optimized(self):
        """测试 Win32 PrintWindow 优化版本（内存中缩放到720p）"""
        ColorPrint.yellow("\n=== Testing Win32 PrintWindow Optimized Version (720p) ===")
        
        try:
            # 计算720p缩放比例
            target_width = 1280
            target_height = 720
            scale_x = target_width / self.screen_width
            scale_y = target_height / self.screen_height
            scale = min(scale_x, scale_y)  # 保持宽高比
            
            new_width = int(self.screen_width * scale)
            new_height = int(self.screen_height * scale)
            
            ColorPrint.blue(f"[Win32 PrintWindow Optimized] Scaling to: {new_width}x{new_height}")
            
            start_time = time.time()
            
            for i in range(self.test_count):
                # 获取桌面窗口句柄
                hdesktop = win32gui.GetDesktopWindow()
                
                # 获取桌面设备上下文
                hdc = win32gui.GetDC(hdesktop)
                
                # 创建内存设备上下文
                memdc = win32ui.CreateDCFromHandle(hdc)
                
                # 创建位图
                bmp = win32ui.CreateBitmap()
                bmp.CreateCompatibleBitmap(memdc, self.screen_width, self.screen_height)
                
                # 选择位图到内存设备上下文
                old_bmp = memdc.SelectObject(bmp)
                
                # 使用 PrintWindow 复制窗口内容
                win32gui.PrintWindow(hdesktop, memdc.GetSafeHdc(), 3)
                
                # 转换为PIL Image并缩放
                bmpinfo = bmp.GetInfo()
                bmpstr = bmp.GetBitmapBits(True)
                img = Image.frombuffer('RGB', (bmpinfo['bmWidth'], bmpinfo['bmHeight']), 
                                     bmpstr, 'raw', 'BGRX', 0, 1)
                
                # 在内存中缩放
                resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # 保存前几张作为示例
                if i < 3:
                    resized_img.save(os.path.join(self.output_dir, f"win32_printwindow_optimized_{i}.png"))
                
                # 清理资源
                memdc.SelectObject(old_bmp)  # 恢复原始位图
                win32gui.DeleteObject(bmp.GetHandle())
                memdc.DeleteDC()
                win32gui.ReleaseDC(hdesktop, hdc)
            
            end_time = time.time()
            duration = end_time - start_time
            
            ColorPrint.green(f"[Win32 PrintWindow Optimized] {self.test_count} screenshots completed in {duration:.3f} seconds")
            ColorPrint.green(f"[Win32 PrintWindow Optimized] Average: {duration/self.test_count*1000:.2f} ms per screenshot")
            
            return duration
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Win32 PrintWindow Optimized test failed: {e}")
            return None
    
    def run_performance_comparison(self):
        """运行性能对比测试"""
        ColorPrint.blue("\n" + "="*60)
        ColorPrint.blue("SCREENSHOT PERFORMANCE COMPARISON TEST (Standard Libraries)")
        ColorPrint.blue("="*60)
        
        results = {}
        
        # 测试所有方法
        results['PIL ImageGrab Basic'] = self.test_pil_imagegrab_basic()
        results['PIL ImageGrab Optimized'] = self.test_pil_imagegrab_optimized()
        results['Win32 BitBlt Basic'] = self.test_win32_bitblt_basic()
        results['Win32 BitBlt Optimized'] = self.test_win32_bitblt_optimized()
        results['Win32 PrintWindow Basic'] = self.test_win32_printwindow_basic()
        results['Win32 PrintWindow Optimized'] = self.test_win32_printwindow_optimized()
        
        # 排序结果
        valid_results = {k: v for k, v in results.items() if v is not None}
        sorted_results = sorted(valid_results.items(), key=lambda x: x[1])
        
        # 显示结果
        ColorPrint.blue("\n" + "="*60)
        ColorPrint.blue("PERFORMANCE RANKING (Fastest to Slowest)")
        ColorPrint.blue("="*60)
        
        for i, (method, duration) in enumerate(sorted_results, 1):
            avg_time = duration / self.test_count * 1000
            ColorPrint.green(f"{i}. {method}: {duration:.3f}s total, {avg_time:.2f}ms per screenshot")
        
        # 计算性能提升
        if len(sorted_results) >= 2:
            fastest = sorted_results[0][1]
            slowest = sorted_results[-1][1]
            improvement = (slowest - fastest) / slowest * 100
            
            ColorPrint.blue(f"\nPerformance Improvement: {improvement:.1f}% faster")
            ColorPrint.blue(f"Fastest method is {slowest/fastest:.1f}x faster than slowest")
        
        # 保存结果到文件
        self.save_results_to_file(sorted_results)
        
        return sorted_results
    
    def save_results_to_file(self, results):
        """保存测试结果到文件"""
        try:
            result_file = os.path.join(self.output_dir, "standard_performance_results.txt")
            
            with open(result_file, 'w', encoding='utf-8') as f:
                f.write("SCREENSHOT PERFORMANCE TEST RESULTS (Standard Libraries)\n")
                f.write("="*60 + "\n\n")
                f.write(f"Test Configuration:\n")
                f.write(f"- Screen Resolution: {self.screen_width}x{self.screen_height}\n")
                f.write(f"- Test Count: {self.test_count} screenshots per method\n")
                f.write(f"- Test Date: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                
                f.write("PERFORMANCE RANKING (Fastest to Slowest):\n")
                f.write("-" * 60 + "\n")
                
                for i, (method, duration) in enumerate(results, 1):
                    avg_time = duration / self.test_count * 1000
                    f.write(f"{i}. {method}: {duration:.3f}s total, {avg_time:.2f}ms per screenshot\n")
                
                if len(results) >= 2:
                    fastest = results[0][1]
                    slowest = results[-1][1]
                    improvement = (slowest - fastest) / slowest * 100
                    f.write(f"\nPerformance Improvement: {improvement:.1f}% faster\n")
                    f.write(f"Fastest method is {slowest/fastest:.1f}x faster than slowest\n")
            
            ColorPrint.green(f"[SAVE] Results saved to: {result_file}")
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to save results: {e}")


def main():
    """主函数"""
    ColorPrint.blue("Starting Screenshot Performance Test (Standard Libraries)...")
    
    try:
        # 创建测试实例
        tester = ScreenshotPerformanceTest()
        
        # 运行性能对比测试
        results = tester.run_performance_comparison()
        
        ColorPrint.green("\n" + "="*60)
        ColorPrint.green("PERFORMANCE TEST COMPLETED SUCCESSFULLY!")
        ColorPrint.green("="*60)
        
        # 显示推荐
        if results:
            fastest_method = results[0][0]
            ColorPrint.yellow(f"RECOMMENDATION: Use '{fastest_method}' for best performance")
        
    except Exception as e:
        ColorPrint.red(f"[ERROR] Performance test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
