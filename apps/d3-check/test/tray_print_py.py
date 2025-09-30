#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Tray Access - Clean Implementation
"""

import time
import win32api
import win32con
from pywinauto import Desktop

def custom_double_click(x, y):
    """Custom double-click function using win32api to avoid tuple errors"""
    try:
        # 移动到指定位置
        win32api.SetCursorPos((x, y))
        time.sleep(0.05)
        
        # 第一次点击
        win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, x, y, 0, 0)
        time.sleep(0.05)
        win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, x, y, 0, 0)
        time.sleep(0.05)
        
        # 第二次点击
        win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, x, y, 0, 0)
        time.sleep(0.05)
        win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, x, y, 0, 0)
        
        return True
    except Exception as e:
        print(f"❌ Error in custom double-click: {e}")
        return False

def access_system_tray():
    """Access system tray using pywinauto"""
    try:
        print("🔍 Accessing system tray...")
        
        # 获取桌面对象
        desktop_explorer = Desktop(backend="uia")
        print("✅ Desktop object created")
        
        print("\n=== 查找系统托盘图标 ===")
        try:
            # 查找所有可能的托盘相关窗口
            all_windows = desktop_explorer.windows()
            tray_windows = []
            for window in all_windows:
                try:
                    class_name = window.class_name()
                    title = window.window_text()
                    
                    # 确保class_name是字符串
                    if isinstance(class_name, str):
                        if any(keyword in class_name.lower() for keyword in ['tray', 'notify', 'shell']):
                            tray_windows.append((window, class_name, title))
                except Exception as e:
                    print(f"❌ Error processing window: {e}")
                    continue
            
            print(f"Found {len(tray_windows)} potential tray-related windows:")
            for i, (window, class_name, title) in enumerate(tray_windows):
                print(f"  {i+1}. Class: {class_name}, Title: {title}")
                print_detailed_tray_info(window, f"TrayWindow_{i+1}")
        except Exception as e:
            print(f"❌ Error finding tray windows: {e}")
        
        print("✅ System tray exploration completed")
        return True
        
    except Exception as e:
        print(f"❌ Error accessing system tray: {e}")
        return False

def click_tray_icon_by_keyword(keyword):
    """Double-click on system tray icon that contains the specified keyword"""
    try:
        print(f"🎯 Searching for tray icon containing keyword: '{keyword}'")
        
        # 记录当前鼠标位置
        original_mouse_pos = win32api.GetCursorPos()
        print(f"📍 Original mouse position: {original_mouse_pos}")
        
        # 获取桌面对象
        desktop_explorer = Desktop(backend="uia")
        
        # 查找所有可能的托盘相关窗口
        all_windows = desktop_explorer.windows()
        tray_windows = []
        for window in all_windows:
            try:
                class_name = window.class_name()
                title = window.window_text()
                
                # 确保class_name和title是字符串
                if isinstance(class_name, str) and isinstance(title, str):
                    if any(keyword in class_name.lower() for keyword in ['tray', 'notify', 'shell']):
                        tray_windows.append(window)
            except Exception as e:
                print(f"❌ Error processing window: {e}")
                continue
        
        found_icons = []
        
        # 遍历所有托盘窗口，查找匹配的图标
        for window in tray_windows:
            try:
                children = window.children()
                for child in children:
                    try:
                        grand_children = child.children()
                        for grand_child in grand_children:
                            title = grand_child.window_text()
                            class_name = grand_child.class_name()
                            
                            # 确保title和class_name是字符串
                            if isinstance(title, str) and isinstance(class_name, str):
                                # 检查是否包含关键字
                                if keyword.lower() in title.lower() or keyword.lower() in class_name.lower():
                                    found_icons.append(grand_child)
                                    print(f"✅ Found matching icon: '{title}' ({class_name})")
                    except Exception as e:
                        print(f"❌ Error processing child: {e}")
                        continue
            except Exception as e:
                print(f"❌ Error processing tray window: {e}")
                continue
        
        if not found_icons:
            print(f"❌ No tray icons found containing keyword: '{keyword}'")
            # 恢复鼠标位置
            win32api.SetCursorPos(original_mouse_pos)
            print(f"🖱️ Mouse position restored to: {original_mouse_pos}")
            return False
        
        # 双击找到的第一个匹配图标
        target_icon = found_icons[0]
        print(f"🖱️ Double-clicking on icon: '{target_icon.window_text()}'")
        
        # 获取图标中心点
        rect = target_icon.rectangle()
        print(f"🔍 Debug - Rectangle data: {rect}")
        print(f"🔍 Debug - Left: {rect.left}, Right: {rect.right}, Top: {rect.top}, Bottom: {rect.bottom}")
        
        # 计算中心点
        center_x = rect.left + (rect.right - rect.left) // 2
        center_y = rect.top + (rect.bottom - rect.top) // 2
        
        print(f"📍 Calculated center point: ({center_x}, {center_y})")
        
        # 对于系统托盘图标，根据观察到的数据调整位置
        # 从输出可以看到，系统托盘图标宽度约为32像素
        icon_width = rect.right - rect.left
        print(f"🔍 Debug - Icon width: {icon_width} pixels")
        
        if icon_width > 100:  # 如果宽度异常大，可能是矩形数据不准确
            # 使用固定的图标宽度（32像素）来计算
            adjusted_x = rect.left + 16  # 32/2 = 16
            print(f"📍 Using fixed width adjustment: ({adjusted_x}, {center_y})")
        else:
            # 使用实际计算的宽度
            adjusted_x = center_x
            print(f"📍 Using calculated width: ({adjusted_x}, {center_y})")
        
        # 使用调整后的位置
        final_x = adjusted_x
        final_y = center_y
        
        print(f"📍 Final double-click position: ({final_x}, {final_y})")
        
        # 移动到目标位置并执行双击
        try:
            win32api.SetCursorPos((final_x, final_y))
            print("✅ Mouse moved to target position")
        except Exception as e:
            print(f"❌ Error moving mouse: {e}")
            return False
            
        time.sleep(0.1)  # 短暂延迟确保鼠标移动完成
        
        # 执行自定义双击
        try:
            if custom_double_click(final_x, final_y):
                print("✅ Double-click executed successfully")
            else:
                print("❌ Double-click failed")
                return False
        except Exception as e:
            print(f"❌ Error during double-click: {e}")
            # 即使双击失败，也要恢复鼠标位置
            win32api.SetCursorPos(original_mouse_pos)
            return False
        
        # 等待一小段时间让双击生效
        time.sleep(0.5)
        
        # 恢复鼠标到原始位置
        try:
            win32api.SetCursorPos(original_mouse_pos)
            print(f"🖱️ Mouse position restored to: {original_mouse_pos}")
        except Exception as e:
            print(f"❌ Error restoring mouse position: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error double-clicking tray icon: {e}")
        import traceback
        print(f"🔍 Full error traceback:")
        traceback.print_exc()
        # 确保在出错时也恢复鼠标位置
        try:
            win32api.SetCursorPos(original_mouse_pos)
            print(f"🖱️ Mouse position restored to: {original_mouse_pos}")
        except:
            pass
        return False

def print_detailed_tray_info(parent, parent_name):
    """Print detailed information about tray icons"""
    try:
        children = parent.children()
        print(f"  {parent_name} has {len(children)} children:")
        
        for i, child in enumerate(children):
            try:
                print(f"    Child {i+1}:")
                print(f"      Title: '{child.window_text()}'")
                print(f"      Class: {child.class_name()}")
                print(f"      AutoID: '{child.automation_id()}'")
                print(f"      Visible: {child.is_visible()}")
                print(f"      Rectangle: {child.rectangle()}")
                
                # 尝试获取更多子元素
                try:
                    grand_children = child.children()
                    if grand_children:
                        print(f"      Has {len(grand_children)} sub-children")
                        for j, grand_child in enumerate(grand_children):
                            title = grand_child.window_text()
                            class_name = grand_child.class_name()
                            auto_id = grand_child.automation_id()
                            rect = grand_child.rectangle()
                            visible = grand_child.is_visible()
                            
                            print(f"        Sub-child {j+1}: '{title}' ({class_name}) AutoID: '{auto_id}'")
                            print(f"          Visible: {visible}")
                            print(f"          Rectangle: {rect}")
                            print(f"          Center Point: ({rect.left + (rect.right - rect.left) // 2}, {rect.top + (rect.bottom - rect.top) // 2})")
                            
                            # 检查是否包含Battle.net - 确保title和class_name是字符串
                            if isinstance(title, str) and isinstance(class_name, str):
                                if 'battle' in title.lower() or 'battle' in class_name.lower():
                                    print(f"          *** FOUND BATTLE.NET RELATED ***")
                                
                            # 尝试获取更多属性
                            try:
                                if hasattr(grand_child, 'is_enabled'):
                                    print(f"          Enabled: {grand_child.is_enabled()}")
                                if hasattr(grand_child, 'is_keyboard_focusable'):
                                    print(f"          Keyboard Focusable: {grand_child.is_keyboard_focusable()}")
                            except:
                                pass
                                
                except Exception as e:
                    print(f"        Error getting sub-children: {e}")
                    
            except Exception as e:
                print(f"      Error getting child info: {e}")
    except Exception as e:
        print(f"  Error getting children: {e}")

def main():
    """Main function"""
    print("🎯 Starting System Tray Access...")
    success = access_system_tray()
    
    if success:
        print("✅ System tray access completed")
        
        # 演示双击功能
        print("\n=== 演示双击功能 ===")
        click_success = click_tray_icon_by_keyword("Battle.net")
        
        if click_success:
            print("✅ Tray icon double-click demonstration completed")
        else:
            print("❌ Tray icon double-click demonstration failed")
    else:
        print("❌ System tray access failed")

if __name__ == "__main__":
    main()