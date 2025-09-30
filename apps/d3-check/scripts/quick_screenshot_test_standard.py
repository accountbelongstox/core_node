#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速屏幕截图测试脚本 - 使用标准库
测试多种截图方法的性能
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

# 添加项目路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(current_dir)
ncore_path = os.path.join(os.path.dirname(os.path.dirname(project_dir)), "ncore")
sys.path.insert(0, ncore_path)

from pytools.pyfoundations.color_print import ColorPrint


def quick_test():
    """快速测试多种截图方法"""
    
    # 设置输出目录
    username = os.getenv('USERNAME', '用户名')
    output_dir = f"C:\\Users\\{username}\\.core_node\\.d3check\\screen_test"
    
    # 创建输出目录
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        ColorPrint.green(f"[INIT] Created output directory: {output_dir}")
    else:
        ColorPrint.blue(f"[INIT] Using existing directory: {output_dir}")
    
    test_count = 5  # 快速测试，只测试5次
    
    # 获取屏幕信息
    screen_width = win32api.GetSystemMetrics(win32con.SM_CXSCREEN)
    screen_height = win32api.GetSystemMetrics(win32con.SM_CYSCREEN)
    
    ColorPrint.blue(f"\n=== Quick Screenshot Performance Test (Standard Libraries) ===")
    ColorPrint.blue(f"Screen resolution: {screen_width}x{screen_height}")
    ColorPrint.blue(f"Test count: {test_count} screenshots per method")
    ColorPrint.blue(f"Output directory: {output_dir}")
    
    results = {}
    
    # 测试 PIL ImageGrab 基础版本
    ColorPrint.yellow("\n--- Testing PIL ImageGrab Basic ---")
    try:
        start_time = time.time()
        
        for i in range(test_count):
            img = ImageGrab.grab()
            if i == 0:  # 只保存第一张
                img.save(os.path.join(output_dir, "pil_imagegrab_basic_sample.png"))
        
        end_time = time.time()
        duration = end_time - start_time
        results['PIL ImageGrab Basic'] = duration
        
        ColorPrint.green(f"PIL ImageGrab Basic: {duration:.3f}s total, {duration/test_count*1000:.2f}ms per screenshot")
        
    except Exception as e:
        ColorPrint.red(f"PIL ImageGrab Basic failed: {e}")
        results['PIL ImageGrab Basic'] = None
    
    # 测试 PIL ImageGrab 优化版本（720p）
    ColorPrint.yellow("\n--- Testing PIL ImageGrab Optimized (720p) ---")
    try:
        # 计算720p缩放比例
        target_width = 1280
        target_height = 720
        scale_x = target_width / screen_width
        scale_y = target_height / screen_height
        scale = min(scale_x, scale_y)
        
        new_width = int(screen_width * scale)
        new_height = int(screen_height * scale)
        
        ColorPrint.blue(f"Scaling to: {new_width}x{new_height}")
        
        start_time = time.time()
        
        for i in range(test_count):
            img = ImageGrab.grab()
            
            # 在内存中缩放
            resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            if i == 0:  # 只保存第一张
                resized_img.save(os.path.join(output_dir, "pil_imagegrab_optimized_sample.png"))
        
        end_time = time.time()
        duration = end_time - start_time
        results['PIL ImageGrab Optimized'] = duration
        
        ColorPrint.green(f"PIL ImageGrab Optimized: {duration:.3f}s total, {duration/test_count*1000:.2f}ms per screenshot")
        
    except Exception as e:
        ColorPrint.red(f"PIL ImageGrab Optimized failed: {e}")
        results['PIL ImageGrab Optimized'] = None
    
    # 测试 Win32 BitBlt 基础版本
    ColorPrint.yellow("\n--- Testing Win32 BitBlt Basic ---")
    try:
        start_time = time.time()
        
        for i in range(test_count):
            # 获取桌面窗口句柄
            hdesktop = win32gui.GetDesktopWindow()
            
            # 获取桌面设备上下文
            hdc = win32gui.GetDC(hdesktop)
            
            # 创建内存设备上下文
            memdc = win32ui.CreateDCFromHandle(hdc)
            
            # 创建位图
            bmp = win32ui.CreateBitmap()
            bmp.CreateCompatibleBitmap(memdc, screen_width, screen_height)
            
            # 选择位图到内存设备上下文
            old_bmp = memdc.SelectObject(bmp)
            
            # 复制屏幕内容到位图
            memdc.BitBlt((0, 0), (screen_width, screen_height), 
                       hdc, (0, 0), win32con.SRCCOPY)
            
            if i == 0:  # 只保存第一张
                bmp.SaveBitmapFile(memdc, os.path.join(output_dir, "win32_bitblt_basic_sample.bmp"))
            
            # 清理资源
            memdc.SelectObject(old_bmp)  # 恢复原始位图
            win32gui.DeleteObject(bmp.GetHandle())
            memdc.DeleteDC()
            win32gui.ReleaseDC(hdesktop, hdc)
        
        end_time = time.time()
        duration = end_time - start_time
        results['Win32 BitBlt Basic'] = duration
        
        ColorPrint.green(f"Win32 BitBlt Basic: {duration:.3f}s total, {duration/test_count*1000:.2f}ms per screenshot")
        
    except Exception as e:
        ColorPrint.red(f"Win32 BitBlt Basic failed: {e}")
        results['Win32 BitBlt Basic'] = None
    
    # 测试 Win32 BitBlt 优化版本（720p）
    ColorPrint.yellow("\n--- Testing Win32 BitBlt Optimized (720p) ---")
    try:
        # 计算720p缩放比例
        target_width = 1280
        target_height = 720
        scale_x = target_width / screen_width
        scale_y = target_height / screen_height
        scale = min(scale_x, scale_y)
        
        new_width = int(screen_width * scale)
        new_height = int(screen_height * scale)
        
        ColorPrint.blue(f"Scaling to: {new_width}x{new_height}")
        
        start_time = time.time()
        
        for i in range(test_count):
            # 获取桌面窗口句柄
            hdesktop = win32gui.GetDesktopWindow()
            
            # 获取桌面设备上下文
            hdc = win32gui.GetDC(hdesktop)
            
            # 创建内存设备上下文
            memdc = win32ui.CreateDCFromHandle(hdc)
            
            # 创建位图
            bmp = win32ui.CreateBitmap()
            bmp.CreateCompatibleBitmap(memdc, screen_width, screen_height)
            
            # 选择位图到内存设备上下文
            old_bmp = memdc.SelectObject(bmp)
            
            # 复制屏幕内容到位图
            memdc.BitBlt((0, 0), (screen_width, screen_height), 
                       hdc, (0, 0), win32con.SRCCOPY)
            
            # 转换为PIL Image并缩放
            bmpinfo = bmp.GetInfo()
            bmpstr = bmp.GetBitmapBits(True)
            img = Image.frombuffer('RGB', (bmpinfo['bmWidth'], bmpinfo['bmHeight']), 
                                 bmpstr, 'raw', 'BGRX', 0, 1)
            
            # 在内存中缩放
            resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            if i == 0:  # 只保存第一张
                resized_img.save(os.path.join(output_dir, "win32_bitblt_optimized_sample.png"))
            
            # 清理资源
            memdc.SelectObject(old_bmp)  # 恢复原始位图
            win32gui.DeleteObject(bmp.GetHandle())
            memdc.DeleteDC()
            win32gui.ReleaseDC(hdesktop, hdc)
        
        end_time = time.time()
        duration = end_time - start_time
        results['Win32 BitBlt Optimized'] = duration
        
        ColorPrint.green(f"Win32 BitBlt Optimized: {duration:.3f}s total, {duration/test_count*1000:.2f}ms per screenshot")
        
    except Exception as e:
        ColorPrint.red(f"Win32 BitBlt Optimized failed: {e}")
        results['Win32 BitBlt Optimized'] = None
    
    # 显示结果
    ColorPrint.blue("\n" + "="*50)
    ColorPrint.blue("PERFORMANCE RANKING (Fastest to Slowest)")
    ColorPrint.blue("="*50)
    
    valid_results = {k: v for k, v in results.items() if v is not None}
    sorted_results = sorted(valid_results.items(), key=lambda x: x[1])
    
    for i, (method, duration) in enumerate(sorted_results, 1):
        avg_time = duration / test_count * 1000
        ColorPrint.green(f"{i}. {method}: {avg_time:.2f}ms per screenshot")
    
    if len(sorted_results) >= 2:
        fastest = sorted_results[0][1]
        slowest = sorted_results[-1][1]
        improvement = (slowest - fastest) / slowest * 100
        
        ColorPrint.blue(f"\nPerformance Improvement: {improvement:.1f}% faster")
        ColorPrint.blue(f"Fastest method is {slowest/fastest:.1f}x faster than slowest")
    
    # 保存结果
    try:
        result_file = os.path.join(output_dir, "quick_standard_test_results.txt")
        with open(result_file, 'w', encoding='utf-8') as f:
            f.write("Quick Screenshot Performance Test Results (Standard Libraries)\n")
            f.write("="*60 + "\n\n")
            f.write(f"Test Configuration:\n")
            f.write(f"- Screen Resolution: {screen_width}x{screen_height}\n")
            f.write(f"- Test Count: {test_count} screenshots per method\n")
            f.write(f"- Test Date: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("PERFORMANCE RANKING:\n")
            f.write("-" * 40 + "\n")
            
            for i, (method, duration) in enumerate(sorted_results, 1):
                avg_time = duration / test_count * 1000
                f.write(f"{i}. {method}: {avg_time:.2f}ms per screenshot\n")
        
        ColorPrint.green(f"\n[SAVE] Results saved to: {result_file}")
        
    except Exception as e:
        ColorPrint.red(f"[ERROR] Failed to save results: {e}")
    
    ColorPrint.green(f"\n[COMPLETE] Sample images saved to: {output_dir}")
    
    return sorted_results


if __name__ == "__main__":
    try:
        quick_test()
    except Exception as e:
        ColorPrint.red(f"[ERROR] Quick test failed: {e}")
        import traceback
        traceback.print_exc()
