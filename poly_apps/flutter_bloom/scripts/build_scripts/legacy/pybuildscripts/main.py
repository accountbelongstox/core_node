# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

import sys
from provider.build_provider import APPNAME, ORIGINAL_FLUTTER_ROOT, BUILD_FLUTTER_ROOT
from pybppkg.bp_fileops import BPFileOperations
from tools.pyprint import Print
from gvar.gvar import GVar
import inspect
from pybppkg.check_android_dir import check_original_flutter_dirs, check_build_flutter_dirs
from pybppkg.pubspec_replace import PubspecReplace
from pybppkg.replace_res_android import find_replacement_source_for_all
from tools.create_app_name import generate_flutter_app_id
from pybppkg.replace_up_android import crop_all_images_to_original_size
from tools.file_tool import clear_directory_recursive
from pybppkg.replace_macos_xcschemes import replace_macos_xcschemes

def show_available_parameters() -> None:
    """
    Show all available parameters from build_provider,
    """
    try:
        import provider.build_provider as bp
        Print.info("\nAvailable parameters:")
        Print.info("=" * 50)
        
        module_vars = inspect.getmembers(bp)
        
        global_vars = sorted([var[0] for var in module_vars 
                            if not var[0].startswith('_') and 
                            isinstance(var[1], (str, list, int, float, bool))])
        
        for i in range(0, len(global_vars), 3):
            line = " | ".join(f"{var:<30}" for var in global_vars[i:i+3])
            Print.info(line)
            
        Print.info("=" * 50)
        Print.info("\nUsage:")
        Print.info("1. Show this help: python main.py")
        Print.info("2. Execute action: python main.py <action> <appname> [variable_name]")
        Print.info("\nAvailable actions:")
        Print.info("- copy_to_build: Copy Flutter project to build directory")
        Print.info("- show: Show project information")
        Print.info("  - show all: Show all variables")
        Print.info("  - show <variable>: Show specific variable")

    except Exception as e:
        Print.error(f"Error showing parameters: {str(e)}")

def main():
    clear_directory_recursive(BUILD_FLUTTER_ROOT)
    copy_result = BPFileOperations.copy_flutter_directory(
        ORIGINAL_FLUTTER_ROOT,
        BUILD_FLUTTER_ROOT
    )
    Print.pretty_print(copy_result)
    
    Print.print_build_provider_exports()
    
    GVar.init_build_provider_vars('replace')
    Print.info("Initialized build provider variables")
    
    check_original_flutter_dirs()
    check_build_flutter_dirs()
    
    # Run PubspecReplace tests
    pubspec_replace = PubspecReplace()
    pubspec_replace.run_all_replace()
    replace_macos_xcschemes()
    images, not_found_filenames = crop_all_images_to_original_size()
    Print.pretty_print(images)
    Print.pretty_print(not_found_filenames)

if __name__ == "__main__":
    main()