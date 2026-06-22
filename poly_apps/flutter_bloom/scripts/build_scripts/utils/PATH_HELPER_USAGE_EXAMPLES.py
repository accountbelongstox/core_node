#!/usr/bin/env python3
"""
PathHelper Usage Examples
Demonstrates how to use PathHelper in different scenarios
"""

from path_helper import PathHelper

# =============================================================================
# EXAMPLE 1: Generating PowerShell Scripts from Python
# =============================================================================

def example_generate_powershell_script():
    """Example: Generate PowerShell script with correct paths"""

    # Raw paths from different sources
    build_root = r"D:\programing\.build_dir\compile_factory\app_wuy_20250118"
    orchestrator_script = r"D:\programing\.build_dir\compile_factory\app_wuy_20250118\build_scripts\00_orchestrator.ps1"
    cleanup_script = r"D:\programing\.build_dir\compile_factory\app_wuy_20250118\build_scripts\01_cleanup.ps1"

    # Normalize all paths for PowerShell
    build_root_ps = PathHelper.normalize_for_powershell(build_root)
    orchestrator_ps = PathHelper.normalize_for_powershell(orchestrator_script)
    cleanup_ps = PathHelper.normalize_for_powershell(cleanup_script)

    # Generate PowerShell script content
    script_content = f'''# Build Orchestrator
Set-Location "{build_root_ps}"
Write-Host "Current directory: $(Get-Location)"

# Execute cleanup
& "{cleanup_ps}"

# Execute orchestrator
& "{orchestrator_ps}"
'''

    print("Generated PowerShell Script:")
    print(script_content)


# =============================================================================
# EXAMPLE 2: File Variable Exchange (Python ↔ PowerShell)
# =============================================================================

def example_file_variable_exchange():
    """Example: Store paths in file variables for PowerShell to read"""

    from shared.data_exchange.unified_variable_system import unified_vars

    # Paths to store
    build_root = r"D:\programing\.build_dir\compile_factory\app_wuy_20250118"
    script_path = r"D:\programing\.build_dir\compile_factory\app_wuy_20250118\android_compile_script.ps1"
    apk_output = r"D:\programing\.build_dir\compile_factory\app_wuy_20250118\build\app\outputs\flutter-apk\app-release.apk"

    # ✅ CORRECT: Normalize before storing
    unified_vars.set_file_variable(
        unified_vars.KEY_BUILD_ROOT,
        PathHelper.normalize_for_powershell(build_root)
    )

    unified_vars.set_file_variable(
        unified_vars.KEY_SCRIPT_PATH,
        PathHelper.normalize_for_powershell(script_path)
    )

    unified_vars.set_file_variable(
        unified_vars.KEY_APK_OUTPUT_PATH,
        PathHelper.normalize_for_powershell(apk_output)
    )

    print("File variables stored (PowerShell format):")
    print(f"BUILD_ROOT: {unified_vars.get_file_variable(unified_vars.KEY_BUILD_ROOT)}")
    print(f"SCRIPT_PATH: {unified_vars.get_file_variable(unified_vars.KEY_SCRIPT_PATH)}")
    print(f"APK_OUTPUT: {unified_vars.get_file_variable(unified_vars.KEY_APK_OUTPUT_PATH)}")


# =============================================================================
# EXAMPLE 3: Flutter Command Construction
# =============================================================================

def example_flutter_command():
    """Example: Build Flutter commands with correct path format"""

    # Entry file path (might come from different sources with different formats)
    entry_file_1 = r"lib\apps\app_wuy\main_app_wuy.dart"
    entry_file_2 = "lib/apps/app_wuy/main_app_wuy.dart"
    entry_file_3 = r"lib\\apps\\app_wuy\\main_app_wuy.dart"

    # All normalize to the same format for Flutter
    entry_normalized_1 = PathHelper.normalize_for_flutter(entry_file_1)
    entry_normalized_2 = PathHelper.normalize_for_flutter(entry_file_2)
    entry_normalized_3 = PathHelper.normalize_for_flutter(entry_file_3)

    print("Flutter path normalization:")
    print(f"Input 1: {entry_file_1}")
    print(f"Output 1: {entry_normalized_1}")
    print(f"Input 2: {entry_file_2}")
    print(f"Output 2: {entry_normalized_2}")
    print(f"Input 3: {entry_file_3}")
    print(f"Output 3: {entry_normalized_3}")

    # Build Flutter command
    flutter_cmd = f"flutter build apk --release -t {entry_normalized_1}"
    print(f"\nFlutter command: {flutter_cmd}")


# =============================================================================
# EXAMPLE 4: Path Joining
# =============================================================================

def example_path_joining():
    """Example: Join paths safely"""

    base = r"D:\programing\.build_dir\compile_factory"
    app_dir = "app_wuy_20250118"
    build_dir = "build"
    output_dir = "app/outputs/flutter-apk"

    # ❌ BAD: String concatenation
    bad_path = base + "\\" + app_dir + "\\" + build_dir + "\\" + output_dir
    print(f"❌ Bad path (string concat): {bad_path}")

    # ✅ GOOD: Use PathHelper.join
    good_path = PathHelper.join(base, app_dir, build_dir, output_dir)
    print(f"✅ Good path (PathHelper): {good_path}")


# =============================================================================
# EXAMPLE 5: Batch Path Normalization
# =============================================================================

def example_batch_normalization():
    """Example: Normalize multiple paths at once"""

    # Mixed format paths
    paths = [
        r"C:\Users\Test\Documents\file1.txt",
        "D:/Projects/MyApp/lib/main.dart",
        r"E:\\Data\\Images\\logo.png",
        "F:/Apps/Flutter/bin/flutter.bat"
    ]

    print("Original paths:")
    for p in paths:
        print(f"  {p}")

    # Normalize all for PowerShell
    normalized = PathHelper.normalize_batch(paths, for_powershell=True)

    print("\nNormalized for PowerShell:")
    for p in normalized:
        print(f"  {p}")


# =============================================================================
# EXAMPLE 6: Path Manipulation
# =============================================================================

def example_path_manipulation():
    """Example: Common path manipulation tasks"""

    file_path = r"D:\Projects\MyApp\lib\apps\app_wuy\main_app_wuy.dart"

    # Get parent directory
    parent_1 = PathHelper.get_parent(file_path, levels=1)
    parent_2 = PathHelper.get_parent(file_path, levels=2)
    parent_3 = PathHelper.get_parent(file_path, levels=3)

    print(f"Original: {file_path}")
    print(f"Parent (1 level): {parent_1}")
    print(f"Parent (2 levels): {parent_2}")
    print(f"Parent (3 levels): {parent_3}")

    # Get filename components
    filename_with_ext = PathHelper.get_filename(file_path, with_extension=True)
    filename_no_ext = PathHelper.get_filename(file_path, with_extension=False)
    extension = PathHelper.get_extension(file_path)

    print(f"\nFilename with extension: {filename_with_ext}")
    print(f"Filename without extension: {filename_no_ext}")
    print(f"Extension: {extension}")

    # Change extension
    new_path = PathHelper.change_extension(file_path, '.py')
    print(f"Changed extension to .py: {new_path}")


# =============================================================================
# EXAMPLE 7: Relative/Absolute Path Conversion
# =============================================================================

def example_relative_absolute():
    """Example: Convert between relative and absolute paths"""

    base_dir = r"D:\Projects\MyApp"
    relative_path = r"lib\apps\app_wuy\main.dart"

    # Convert to absolute
    absolute = PathHelper.to_absolute(relative_path, base_dir)
    print(f"Base: {base_dir}")
    print(f"Relative: {relative_path}")
    print(f"Absolute: {absolute}")

    # Convert back to relative
    back_to_relative = PathHelper.to_relative(absolute, base_dir)
    print(f"Back to relative: {back_to_relative}")


# =============================================================================
# EXAMPLE 8: Escaping Paths with Spaces
# =============================================================================

def example_escape_paths():
    """Example: Handle paths with spaces for PowerShell"""

    path_with_spaces = r"C:\Program Files\My Application\bin\app.exe"
    path_without_spaces = r"C:\Users\Test\app.exe"

    escaped_1 = PathHelper.escape_for_powershell(path_with_spaces)
    escaped_2 = PathHelper.escape_for_powershell(path_without_spaces)

    print(f"Path with spaces: {path_with_spaces}")
    print(f"Escaped: {escaped_1}")
    print(f"\nPath without spaces: {path_without_spaces}")
    print(f"Escaped: {escaped_2}")

    # Use in PowerShell command
    ps_command = f"& {escaped_1}"
    print(f"\nPowerShell command: {ps_command}")


# =============================================================================
# RUN ALL EXAMPLES
# =============================================================================

if __name__ == "__main__":
    print("=" * 80)
    print("PATHHELPER USAGE EXAMPLES")
    print("=" * 80)

    examples = [
        ("Generating PowerShell Scripts", example_generate_powershell_script),
        ("Flutter Command Construction", example_flutter_command),
        ("Path Joining", example_path_joining),
        ("Batch Normalization", example_batch_normalization),
        ("Path Manipulation", example_path_manipulation),
        ("Relative/Absolute Conversion", example_relative_absolute),
        ("Escaping Paths with Spaces", example_escape_paths),
    ]

    for title, func in examples:
        print(f"\n{'=' * 80}")
        print(f"EXAMPLE: {title}")
        print(f"{'=' * 80}\n")
        func()

    print(f"\n{'=' * 80}")
    print("ALL EXAMPLES COMPLETED")
    print(f"{'=' * 80}")
