# Script to launch 6 Windows Terminal windows and arrange them evenly across the screen

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Add Win32 API functions for window management
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;

public class WindowManager {
    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    
    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int processId);
    
    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);
    
    [DllImport("user32.dll")]
    public static extern bool SystemParametersInfo(int uAction, int uParam, ref RECT lpvParam, int fuWinIni);
    
    public const int SM_CXSCREEN = 0;
    public const int SM_CYSCREEN = 1;
    public const int SM_XVIRTUALSCREEN = 76;
    public const int SM_YVIRTUALSCREEN = 77;
    public const int SM_CXVIRTUALSCREEN = 78;
    public const int SM_CYVIRTUALSCREEN = 79;
    public const int SPI_GETWORKAREA = 48;
    
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
"@

# Get virtual desktop dimensions (entire OS desktop across all monitors)
try {
    # Get virtual screen position and size (covers all monitors)
    $screenX = [WindowManager]::GetSystemMetrics([WindowManager]::SM_XVIRTUALSCREEN)
    $screenY = [WindowManager]::GetSystemMetrics([WindowManager]::SM_YVIRTUALSCREEN)
    $screenWidth = [WindowManager]::GetSystemMetrics([WindowManager]::SM_CXVIRTUALSCREEN)
    $screenHeight = [WindowManager]::GetSystemMetrics([WindowManager]::SM_CYVIRTUALSCREEN)
    
    if ($screenWidth -le 0 -or $screenHeight -le 0) {
        throw "Invalid virtual screen dimensions from GetSystemMetrics"
    }
    
    Write-Host "Using Win32 API: Virtual desktop (all monitors) dimensions" -ForegroundColor Green
} catch {
    # Fallback: Calculate virtual desktop from all screens
    Write-Host "Warning: Win32 API method failed, calculating from all screens" -ForegroundColor Yellow
    try {
        $allScreens = [System.Windows.Forms.Screen]::AllScreens
        if ($null -ne $allScreens -and $allScreens.Length -gt 0) {
            # Find the bounds of all screens combined
            $minX = [int]::MaxValue
            $minY = [int]::MaxValue
            $maxX = [int]::MinValue
            $maxY = [int]::MinValue
            
            foreach ($screen in $allScreens) {
                $bounds = $screen.Bounds
                if ($bounds.Left -lt $minX) { $minX = $bounds.Left }
                if ($bounds.Top -lt $minY) { $minY = $bounds.Top }
                if ($bounds.Right -gt $maxX) { $maxX = $bounds.Right }
                if ($bounds.Bottom -gt $maxY) { $maxY = $bounds.Bottom }
            }
            
            $screenX = $minX
            $screenY = $minY
            $screenWidth = $maxX - $minX
            $screenHeight = $maxY - $minY
            
            Write-Host "Using System.Windows.Forms: Calculated virtual desktop from $($allScreens.Length) screen(s)" -ForegroundColor Green
        } else {
            throw "AllScreens is null or empty"
        }
    } catch {
        # Last resort: use primary screen
        Write-Host "Warning: Using primary screen only as fallback" -ForegroundColor Yellow
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen
        if ($null -ne $screen) {
            $screenWidth = $screen.Bounds.Width
            $screenHeight = $screen.Bounds.Height
            $screenX = $screen.Bounds.X
            $screenY = $screen.Bounds.Y
            Write-Host "Using System.Windows.Forms: Primary screen dimensions only" -ForegroundColor Yellow
        } else {
            Write-Host "Error: Failed to get screen dimensions: $_" -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host "Screen dimensions: ${screenWidth}x${screenHeight}"
Write-Host "Screen position: ${screenX}, ${screenY}"

# Calculate grid layout: 3 columns, 2 rows
$columns = 3
$rows = 2
$windowWidth = [Math]::Floor($screenWidth / $columns)
$windowHeight = [Math]::Floor($screenHeight / $rows)

Write-Host "Window size: ${windowWidth}x${windowHeight}"

# Function to find window handle by process ID
function FindWindowByProcessId {
    param([int]$processId)
    
    $script:windowHandle = [IntPtr]::Zero
    $targetPid = $processId
    
    $callback = [WindowManager+EnumWindowsProc]{
        param([IntPtr]$hWnd, [IntPtr]$lParam)
        $processId = 0
        [WindowManager]::GetWindowThreadProcessId($hWnd, [ref]$processId) | Out-Null
        if ($processId -eq $targetPid) {
            $script:windowHandle = $hWnd
            return $false
        }
        return $true
    }
    
    [WindowManager]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
    return $script:windowHandle
}

# Store processes and window handles
$processes = @()

# Launch 6 terminal windows first
for ($i = 0; $i -lt 6; $i++) {
    Write-Host "Launching terminal window $($i + 1)..."
    $process = Start-Process "wt.exe" -PassThru
    $processes += $process
    Start-Sleep -Milliseconds 800
}

Write-Host "Waiting for all windows to initialize..."
Start-Sleep -Seconds 2

# Get window handles and arrange them
$windowHandles = @()
foreach ($proc in $processes) {
    $hWnd = FindWindowByProcessId($proc.Id)
    if ($hWnd -ne [IntPtr]::Zero) {
        $windowHandles += $hWnd
    }
}

# Arrange windows in grid
$windowIndex = 0
for ($row = 0; $row -lt $rows; $row++) {
    for ($col = 0; $col -lt $columns; $col++) {
        if ($windowIndex -lt $windowHandles.Count) {
            # Calculate window position
            $windowX = $screenX + ($col * $windowWidth)
            $windowY = $screenY + ($row * $windowHeight)
            
            $hWnd = $windowHandles[$windowIndex]
            
            Write-Host "Arranging window $($windowIndex + 1) at position: ${windowX}, ${windowY} with size: ${windowWidth}x${windowHeight}"
            
            # Move and resize window using Win32 API
            [WindowManager]::MoveWindow($hWnd, $windowX, $windowY, $windowWidth, $windowHeight, $true) | Out-Null
            
            $windowIndex++
            Start-Sleep -Milliseconds 200
        }
    }
}

Write-Host "All 6 terminal windows launched and arranged."
