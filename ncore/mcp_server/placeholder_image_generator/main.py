#!/usr/bin/env python3

import asyncio
import json
import os
import sys
import subprocess
import importlib.util
import signal
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import tempfile

# Add MCP imports after package installation check
mcp = None
PIL = None

class PackageManager:
    """Manages Python package installation and verification"""

    REQUIRED_PACKAGES = [
        "mcp",
        "pillow"
    ]

    @staticmethod
    def check_package(package_name: str) -> bool:
        """Check if a package is installed"""
        try:
            spec = importlib.util.find_spec(package_name)
            return spec is not None
        except ImportError:
            return False

    @staticmethod
    def install_package(package_name: str) -> bool:
        """Install a package using pip"""
        try:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install", package_name
            ], timeout=300)  # 5 minute timeout to prevent hanging
            return True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            return False

    @classmethod
    def ensure_packages(cls) -> bool:
        """Ensure all required packages are installed"""
        missing_packages = []

        for package in cls.REQUIRED_PACKAGES:
            if not cls.check_package(package):
                missing_packages.append(package)

        if missing_packages:
            print(f"Missing packages: {', '.join(missing_packages)}")
            for package in missing_packages:
                print(f"Installing {package}...")
                if not cls.install_package(package):
                    print(f"Failed to install {package}")
                    return False
                print(f"Successfully installed {package}")

        return True

class PlaceholderDatabase:
    """Manages JSON database for placeholder image records"""

    def __init__(self):
        self.user_dir = Path.home()
        self.db_dir = self.user_dir / ".core_node" / "mcp_server" / "placeholder_images"
        self.db_file = self.db_dir / "placeholder_records.json"
        self._ensure_db_directory()
        self._load_database()

    def _ensure_db_directory(self):
        """Create database directory if it doesn't exist"""
        self.db_dir.mkdir(parents=True, exist_ok=True)

    def _load_database(self):
        """Load existing database or create new one"""
        if self.db_file.exists():
            try:
                with open(self.db_file, 'r', encoding='utf-8') as f:
                    self.data = json.load(f)
            except (json.JSONDecodeError, IOError):
                self.data = {"records": [], "metadata": {"version": "1.0", "created": datetime.now().isoformat()}}
        else:
            self.data = {"records": [], "metadata": {"version": "1.0", "created": datetime.now().isoformat()}}
            self._save_database()

    def _save_database(self):
        """Save database to file"""
        try:
            with open(self.db_file, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, indent=2, ensure_ascii=True)
        except IOError as e:
            print(f"Failed to save database: {e}")

    def add_record(self, image_path: str, width: int, height: int, filename: str):
        """Add a new placeholder image record"""
        record = {
            "id": len(self.data["records"]) + 1,
            "image_path": image_path,
            "filename": filename,
            "width": width,
            "height": height,
            "created_at": datetime.now().isoformat(),
            "file_size": os.path.getsize(image_path) if os.path.exists(image_path) else 0
        }

        self.data["records"].append(record)
        self.data["metadata"]["last_updated"] = datetime.now().isoformat()
        self._save_database()
        return record

    def get_records(self) -> List[Dict]:
        """Get all placeholder image records"""
        return self.data["records"]

    def find_by_path(self, image_path: str) -> Optional[Dict]:
        """Find record by image path"""
        for record in self.data["records"]:
            if record["image_path"] == image_path:
                return record
        return None

class PlaceholderImageGenerator:
    """Generates placeholder images with text overlay"""

    def __init__(self):
        self.database = PlaceholderDatabase()

    def _validate_and_normalize_path(self, image_path: str) -> Tuple[bool, str, str]:
        """Validate and normalize the image path"""
        try:
            # Convert to Path object for better handling
            path_obj = Path(image_path)

            # Normalize the path (resolve relative paths, handle different separators)
            try:
                normalized_path = path_obj.resolve()
            except (OSError, RuntimeError):
                # If resolve fails, use absolute path
                normalized_path = path_obj.absolute()

            # Convert back to string with forward slashes for consistency
            normalized_str = str(normalized_path).replace('\\', '/')

            # Check if it's a valid file extension for images
            valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.webp'}
            if normalized_path.suffix.lower() not in valid_extensions:
                return False, f"Invalid image extension: {normalized_path.suffix}", normalized_str

            return True, "Path validated successfully", normalized_str

        except Exception as e:
            return False, f"Path validation error: {str(e)}", image_path

    def _ensure_directory_access(self, dir_path: Path) -> Tuple[bool, str]:
        """Ensure directory exists and is writable"""
        try:
            # Create directory structure if it doesn't exist
            dir_path.mkdir(parents=True, exist_ok=True)

            # Test write permissions by creating a temporary file
            test_file = dir_path / "tmp_write_test.tmp"
            try:
                test_file.write_text("test")
                test_file.unlink()  # Delete test file
                return True, "Directory access confirmed"
            except (PermissionError, OSError) as e:
                return False, f"No write permission to directory: {dir_path} - {str(e)}"

        except (PermissionError, OSError) as e:
            return False, f"Cannot create directory: {dir_path} - {str(e)}"

    def generate_placeholder(self, image_path: str, width: int, height: int) -> Tuple[bool, str]:
        """Generate a placeholder image with filename and dimensions overlay"""
        try:
            # Import PIL after package verification
            from PIL import Image, ImageDraw, ImageFont

            # Validate and normalize the path
            is_valid, validation_msg, normalized_path = self._validate_and_normalize_path(image_path)
            if not is_valid:
                return False, validation_msg

            # Use normalized path for all operations
            path_obj = Path(normalized_path)
            output_dir = path_obj.parent

            # Ensure directory exists and is writable
            dir_accessible, dir_msg = self._ensure_directory_access(output_dir)
            if not dir_accessible:
                return False, dir_msg

            # Create image
            image = Image.new('RGB', (width, height), color='#f0f0f0')
            draw = ImageDraw.Draw(image)

            # Extract filename from normalized path
            filename = path_obj.name

            # Prepare text content
            filename_text = filename
            dimension_text = f"{width}x{height}"

            # Try to use a default font, fallback to default if not available
            try:
                font_size = min(width, height) // 20
                font_size = max(12, min(font_size, 48))  # Clamp between 12 and 48
                font = ImageFont.truetype("arial.ttf", font_size)
            except (OSError, IOError):
                font = ImageFont.load_default()

            # Calculate text positions
            bbox_filename = draw.textbbox((0, 0), filename_text, font=font)
            bbox_dimension = draw.textbbox((0, 0), dimension_text, font=font)

            filename_width = bbox_filename[2] - bbox_filename[0]
            filename_height = bbox_filename[3] - bbox_filename[1]
            dimension_width = bbox_dimension[2] - bbox_dimension[0]
            dimension_height = bbox_dimension[3] - bbox_dimension[1]

            # Center filename text
            filename_x = (width - filename_width) // 2
            filename_y = (height - filename_height) // 2 - 20

            # Center dimension text below filename
            dimension_x = (width - dimension_width) // 2
            dimension_y = filename_y + filename_height + 10

            # Draw background rectangles for better text visibility
            padding = 5
            draw.rectangle([
                filename_x - padding, filename_y - padding,
                filename_x + filename_width + padding, filename_y + filename_height + padding
            ], fill='#ffffff', outline='#cccccc')

            draw.rectangle([
                dimension_x - padding, dimension_y - padding,
                dimension_x + dimension_width + padding, dimension_y + dimension_height + padding
            ], fill='#ffffff', outline='#cccccc')

            # Draw text
            draw.text((filename_x, filename_y), filename_text, fill='#333333', font=font)
            draw.text((dimension_x, dimension_y), dimension_text, fill='#666666', font=font)

            # Add border
            draw.rectangle([0, 0, width-1, height-1], outline='#cccccc', width=2)

            # Save image using normalized path
            image.save(normalized_path, 'JPEG', quality=90)

            # Add to database with normalized path
            self.database.add_record(normalized_path, width, height, filename)

            return True, f"Placeholder image generated: {normalized_path}"

        except Exception as e:
            return False, f"Failed to generate placeholder image: {str(e)}"

    def list_placeholders(self) -> List[Dict]:
        """List all generated placeholder images"""
        return self.database.get_records()

    def check_path_access(self, path: str) -> Dict[str, any]:
        """Check if a path is accessible and return detailed information"""
        try:
            # Validate and normalize the path
            is_valid, validation_msg, normalized_path = self._validate_and_normalize_path(path)

            path_obj = Path(normalized_path)
            parent_dir = path_obj.parent

            result = {
                "original_path": path,
                "normalized_path": normalized_path,
                "is_valid_path": is_valid,
                "validation_message": validation_msg,
                "exists": path_obj.exists(),
                "is_file": path_obj.is_file() if path_obj.exists() else False,
                "is_directory": path_obj.is_dir() if path_obj.exists() else False,
                "parent_exists": parent_dir.exists(),
                "parent_writable": False,
                "absolute_path": str(path_obj.absolute()),
                "drive_or_root": str(path_obj.anchor) if hasattr(path_obj, 'anchor') else "/",
            }

            # Check parent directory accessibility
            if parent_dir.exists():
                dir_accessible, dir_msg = self._ensure_directory_access(parent_dir)
                result["parent_writable"] = dir_accessible
                result["access_message"] = dir_msg
            else:
                # Try to create parent directory to test access
                try:
                    parent_dir.mkdir(parents=True, exist_ok=True)
                    dir_accessible, dir_msg = self._ensure_directory_access(parent_dir)
                    result["parent_writable"] = dir_accessible
                    result["access_message"] = f"Created directory and tested: {dir_msg}"
                except Exception as e:
                    result["access_message"] = f"Cannot create parent directory: {str(e)}"

            return result

        except Exception as e:
            return {
                "original_path": path,
                "error": f"Path check failed: {str(e)}",
                "is_valid_path": False
            }

# MCP Server using FastMCP framework

# Create FastMCP server instance
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("PlaceholderImageGenerator")

def main():
    """Main MCP server function using FastMCP"""
    try:
        print("[MAIN] Starting FastMCP Placeholder Image Generator...")

        # Initialize placeholder generator
        placeholder_server = PlaceholderImageGenerator()
        print("[SUCCESS] Placeholder generator initialized")

        @mcp.tool()
        def generate_placeholder(image_path: str, width: int, height: int) -> str:
            """Generate a placeholder image with filename and dimensions overlay

            Args:
                image_path: Full path where the placeholder image should be saved (supports all system paths)
                width: Width of the placeholder image in pixels
                height: Height of the placeholder image in pixels

            Returns:
                Success message with generated image path
            """
            try:
                print(f"[TOOL] generate_placeholder called: {image_path}, {width}x{height}")
                success, message = placeholder_server.generate_placeholder(image_path, width, height)

                if success:
                    result = {
                        "success": True,
                        "message": message,
                        "image_path": image_path,
                        "dimensions": f"{width}x{height}"
                    }
                else:
                    result = {"error": message}

                print(f"[SUCCESS] generate_placeholder completed")
                return json.dumps(result, indent=2)

            except Exception as e:
                error_result = {"error": f"Failed to generate placeholder: {str(e)}"}
                print(f"[ERROR] generate_placeholder failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def list_placeholders() -> str:
            """List all generated placeholder images

            Returns:
                JSON list of all placeholder image records
            """
            try:
                print("[TOOL] list_placeholders called")
                records = placeholder_server.list_placeholders()
                result = {
                    "success": True,
                    "count": len(records),
                    "placeholders": records
                }
                print(f"[SUCCESS] list_placeholders completed - {len(records)} records")
                return json.dumps(result, indent=2)

            except Exception as e:
                error_result = {"error": f"Failed to list placeholders: {str(e)}"}
                print(f"[ERROR] list_placeholders failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def check_path_access(path: str) -> str:
            """Check if a path is accessible and get detailed information about path permissions

            Args:
                path: Full path to check for accessibility (any system path)

            Returns:
                Detailed path information including permissions and accessibility
            """
            try:
                print(f"[TOOL] check_path_access called: {path}")
                result = placeholder_server.check_path_access(path)
                response = {
                    "success": True,
                    "path_info": result
                }
                print("[SUCCESS] check_path_access completed")
                return json.dumps(response, indent=2)

            except Exception as e:
                error_result = {"error": f"Failed to check path access: {str(e)}"}
                print(f"[ERROR] check_path_access failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def health_check() -> str:
            """Check server health and return system information

            Returns:
                System health information and server status
            """
            try:
                print("[TOOL] health_check called")
                import platform
                from datetime import datetime

                # Get system information
                health_info = {
                    "server_status": "healthy",
                    "timestamp": datetime.now().isoformat(),
                    "system": {
                        "platform": platform.system(),
                        "platform_release": platform.release(),
                        "platform_version": platform.version(),
                        "architecture": platform.machine(),
                        "hostname": platform.node(),
                        "python_version": platform.python_version(),
                        "python_executable": sys.executable,
                    },
                    "database": {
                        "location": str(placeholder_server.database.db_file),
                        "exists": placeholder_server.database.db_file.exists(),
                        "record_count": len(placeholder_server.database.get_records()),
                    },
                    "dependencies": {
                        "mcp": "available",
                        "pillow": "available",
                    },
                    "capabilities": [
                        "generate_placeholder",
                        "list_placeholders",
                        "check_path_access",
                        "health_check"
                    ]
                }

                # Test database access
                try:
                    placeholder_server.database._load_database()
                    health_info["database"]["accessible"] = True
                except Exception as e:
                    health_info["database"]["accessible"] = False
                    health_info["database"]["error"] = str(e)

                # Test PIL functionality
                try:
                    from PIL import Image
                    test_image = Image.new('RGB', (1, 1), color='white')
                    health_info["dependencies"]["pillow_functional"] = True
                except Exception as e:
                    health_info["dependencies"]["pillow_functional"] = False
                    health_info["dependencies"]["pillow_error"] = str(e)

                result = {
                    "success": True,
                    "health": health_info
                }

                print("[SUCCESS] health_check completed")
                return json.dumps(result, indent=2)

            except Exception as e:
                error_result = {"error": f"Health check failed: {str(e)}"}
                print(f"[ERROR] health_check failed: {e}")
                return json.dumps(error_result, indent=2)

        print("[FASTMCP] Starting FastMCP server...")
        mcp.run()

    except KeyboardInterrupt:
        print("[STOP] Server stopped by user")
    except Exception as e:
        print(f"[CRITICAL] Critical server error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def init():
    """Initialize the MCP server with package verification"""
    print("[INIT] Initializing Placeholder Image Generator MCP Server...")

    try:
        # Check and install required packages
        print("[PACKAGE] Checking required packages...")
        if not PackageManager.ensure_packages():
            print("[ERROR] Failed to install required packages")
            sys.exit(1)

        print("[SUCCESS] All required packages are available")
        print("[START] Starting MCP server...")

        # Set up proper asyncio policy for Windows
        if sys.platform == 'win32':
            try:
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
                print("[SUCCESS] Windows asyncio policy set")
            except Exception as e:
                print(f"[WARNING] Failed to set Windows asyncio policy: {e}")

        # Run the FastMCP server
        try:
            main()
        except KeyboardInterrupt:
            print("[STOP] Server stopped by user")
            sys.exit(0)
        except SystemExit:
            raise
        except Exception as e:
            print(f"[ERROR] Server failed to start: {e}")
            import traceback
            print("[DEBUG] Full error traceback:")
            traceback.print_exc()
            sys.exit(1)

    except SystemExit:
        raise
    except Exception as e:
        print(f"[CRITICAL] Critical initialization error: {e}")
        import traceback
        print("[DEBUG] Full error traceback:")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    init()