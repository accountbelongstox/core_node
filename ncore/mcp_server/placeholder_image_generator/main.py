#!/usr/bin/env python3

import asyncio
import json
import os
import sys
import subprocess
import importlib.util
import signal
import hashlib
import time
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
        "pillow",
        "requests"
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

class APICircuitBreaker:
    """Circuit breaker for API failure tracking - blocks failed APIs"""

    def __init__(self):
        self.failed_apis = set()  # In-memory cache of failed API names

    def mark_failed(self, api_name: str):
        """Mark an API as failed (will be blocked)"""
        self.failed_apis.add(api_name)
        print(f"[CIRCUIT_BREAKER] [BLOCKED] API '{api_name}' marked as FAILED and will be BLOCKED")

    def is_blocked(self, api_name: str) -> bool:
        """Check if API is blocked"""
        blocked = api_name in self.failed_apis
        if blocked:
            print(f"[CIRCUIT_BREAKER] [SKIP] API '{api_name}' is BLOCKED (previously failed)")
        return blocked

    def reset(self):
        """Reset all blocks (for testing or recovery)"""
        count = len(self.failed_apis)
        self.failed_apis.clear()
        print(f"[CIRCUIT_BREAKER] [OK] Reset: Unblocked {count} APIs")

    def get_status(self) -> dict:
        """Get current status"""
        return {
            "blocked_apis": list(self.failed_apis),
            "blocked_count": len(self.failed_apis)
        }


class URLRateLimiter:
    """Manages URL request rate limiting with persistent cache"""

    MIN_REQUEST_INTERVAL = 5.0  # 5 seconds between requests for same URL

    def __init__(self):
        """Initialize rate limiter with cache directory"""
        # Use user's home directory for cache
        self.user_dir = Path.home()
        self.cache_dir = self.user_dir / ".core_node" / "placeholder_image_generator"
        self._ensure_cache_directory()
        print(f"[RATE_LIMITER] Cache directory: {self.cache_dir}")

    def _ensure_cache_directory(self):
        """Create cache directory if it doesn't exist"""
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        print(f"[RATE_LIMITER] Cache directory ready: {self.cache_dir}")

    def _get_url_hash(self, url: str) -> str:
        """Generate MD5 hash for URL"""
        return hashlib.md5(url.encode('utf-8')).hexdigest()

    def _get_cache_file(self, url: str) -> Path:
        """Get cache file path for URL"""
        url_hash = self._get_url_hash(url)
        return self.cache_dir / f"{url_hash}.json"

    def _read_last_request_time(self, url: str) -> Optional[float]:
        """Read last request timestamp from cache file"""
        cache_file = self._get_cache_file(url)

        if not cache_file.exists():
            return None

        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('last_request_time')
        except (json.JSONDecodeError, IOError):
            return None

    def _write_request_time(self, url: str, timestamp: float):
        """Write request timestamp to cache file"""
        cache_file = self._get_cache_file(url)

        try:
            data = {
                'url': url,
                'url_hash': self._get_url_hash(url),
                'last_request_time': timestamp,
                'last_request_datetime': datetime.fromtimestamp(timestamp).isoformat()
            }

            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except IOError as e:
            print(f"[WARNING] Failed to write cache file for URL: {e}")

    def wait_if_needed(self, url: str):
        """Wait if necessary to respect rate limit for URL

        Args:
            url: The URL to check rate limit for
        """
        last_request_time = self._read_last_request_time(url)
        current_time = time.time()

        if last_request_time is not None:
            elapsed = current_time - last_request_time

            if elapsed < self.MIN_REQUEST_INTERVAL:
                wait_time = self.MIN_REQUEST_INTERVAL - elapsed
                print(f"[RATE_LIMITER] URL: {url[:50]}...")
                print(f"[RATE_LIMITER] Last request: {elapsed:.2f}s ago")
                print(f"[RATE_LIMITER] Waiting {wait_time:.2f}s to respect rate limit...")
                time.sleep(wait_time)
                print(f"[RATE_LIMITER] Wait complete, proceeding with request")
            else:
                print(f"[RATE_LIMITER] URL ok ({elapsed:.2f}s since last request)")
        else:
            print(f"[RATE_LIMITER] First request for this URL")

        # Record this request
        self._write_request_time(url, time.time())

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

    def add_record(self, image_path: str, width: int, height: int, filename: str,
                   placeholder_type: str = "default", image_metadata: dict = None):
        """Add a new placeholder image record with metadata"""
        record = {
            "id": len(self.data["records"]) + 1,
            "image_path": image_path,
            "filename": filename,
            "width": width,
            "height": height,
            "placeholder_type": placeholder_type,
            "created_at": datetime.now().isoformat(),
            "file_size": os.path.getsize(image_path) if os.path.exists(image_path) else 0
        }

        if image_metadata:
            record["metadata"] = image_metadata

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

    BING_IMAGE_API = "https://bing.img.run/rand_1366x768.php"
    BING_FETCH_TIMEOUT = 10
    UNSPLASH_ACCESS_KEY = "sUgzcLPI22a7oOMYMCrO4gVdO3jOyXzOplktg5BGOCs"
    UNSPLASH_RANDOM_API = "https://api.unsplash.com/photos/random"
    UNSPLASH_SEARCH_API = "https://api.unsplash.com/search/photos"
    UNSPLASH_FETCH_TIMEOUT = 15
    RPIC_IMAGE_API = "https://rpic.origz.com/api.php?category=photography"
    RPIC_FETCH_TIMEOUT = 15
    LTYUANFANG_IMAGE_API = "https://tu.ltyuanfang.cn/api/fengjing.php"
    LTYUANFANG_FETCH_TIMEOUT = 15
    ALL_IMAGE_SOURCES = ["unsplash", "bing", "rpic", "ltyuanfang"]

    def __init__(self):
        self.database = PlaceholderDatabase()
        self.rate_limiter = URLRateLimiter()
        self.circuit_breaker = APICircuitBreaker()
        print("[INIT] PlaceholderImageGenerator initialized with rate limiter and circuit breaker")

    def _call_api_with_circuit_breaker(self, api_name: str, api_func, *args, **kwargs):
        """
        Call API function with circuit breaker protection

        Args:
            api_name: Name of the API (e.g., 'unsplash_search', 'bing_image')
            api_func: The API function to call
            *args, **kwargs: Arguments to pass to the API function

        Returns:
            Result from api_func, or None if blocked or failed
        """
        import requests

        # Check if API is blocked
        if self.circuit_breaker.is_blocked(api_name):
            return None

        # Try calling the API
        try:
            print(f"[API_CALL] Calling '{api_name}'...")
            result = api_func(*args, **kwargs)

            if result is None or (isinstance(result, tuple) and result[0] is None):
                # API returned None or (None, ...) - consider it a failure
                print(f"[API_CALL] '{api_name}' returned None (failed)")
                self.circuit_breaker.mark_failed(api_name)
                return None

            print(f"[API_CALL] [OK] '{api_name}' succeeded")
            return result

        except (requests.exceptions.Timeout, TimeoutError) as e:
            print(f"[API_CALL] [TIMEOUT] '{api_name}' TIMEOUT: {str(e)}")
            self.circuit_breaker.mark_failed(api_name)
            return None

        except Exception as e:
            print(f"[API_CALL] [ERROR] '{api_name}' FAILED: {str(e)}")
            self.circuit_breaker.mark_failed(api_name)
            return None

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

    def _fetch_bing_image(self) -> Tuple[Optional[bytes], Optional[dict]]:
        """Fetch random image from Bing API"""
        try:
            import requests
            # Apply rate limiting
            self.rate_limiter.wait_if_needed(self.BING_IMAGE_API)
            response = requests.get(self.BING_IMAGE_API, timeout=self.BING_FETCH_TIMEOUT)
            if response.status_code == 200:
                metadata = {
                    "source": "bing",
                    "source_name": "Bing Random Image API",
                    "description": "Random image from Bing",
                    "url": self.BING_IMAGE_API
                }
                return response.content, metadata
            else:
                print(f"[WARNING] Bing API returned status code: {response.status_code}")
                return None, None
        except Exception as e:
            print(f"[WARNING] Failed to fetch Bing image: {str(e)}")
            return None, None

    def _fetch_unsplash_image(self, search_query: str = None) -> Tuple[Optional[bytes], Optional[dict]]:
        """Fetch image from Unsplash API with metadata (random or search)

        Args:
            search_query: Optional search keywords (e.g. "mountain sunset", "city night")
                         If None, returns random image

        Returns:
            Tuple of (image_bytes, metadata_dict)
        """
        try:
            import requests

            headers = {
                "Authorization": f"Client-ID {self.UNSPLASH_ACCESS_KEY}"
            }

            if search_query:
                print(f"[INFO] Searching Unsplash for: '{search_query}'")
                params = {
                    "query": search_query,
                    "orientation": "landscape",
                    "per_page": 1,
                    "order_by": "relevant"
                }

                # Apply rate limiting for search API
                print(f"[DEBUG] Checking rate limit for: {self.UNSPLASH_SEARCH_API}")
                self.rate_limiter.wait_if_needed(self.UNSPLASH_SEARCH_API)
                print(f"[DEBUG] Rate limit check passed, sending request...")
                print(f"[DEBUG] Request URL: {self.UNSPLASH_SEARCH_API}")
                print(f"[DEBUG] Request params: {params}")
                print(f"[DEBUG] Timeout: {self.UNSPLASH_FETCH_TIMEOUT}s")

                response = requests.get(
                    self.UNSPLASH_SEARCH_API,
                    headers=headers,
                    params=params,
                    timeout=self.UNSPLASH_FETCH_TIMEOUT
                )
                print(f"[DEBUG] Response received, status code: {response.status_code}")

                if response.status_code == 200:
                    search_data = response.json()
                    results = search_data.get("results", [])

                    if not results:
                        print(f"[WARNING] No Unsplash results for query: '{search_query}'")
                        return None, None

                    data = results[0]
                else:
                    print(f"[WARNING] Unsplash search API returned status code: {response.status_code}")
                    return None, None
            else:
                print("[INFO] Fetching random Unsplash image")
                params = {
                    "orientation": "landscape"
                }

                # Apply rate limiting for random API
                self.rate_limiter.wait_if_needed(self.UNSPLASH_RANDOM_API)
                response = requests.get(
                    self.UNSPLASH_RANDOM_API,
                    headers=headers,
                    params=params,
                    timeout=self.UNSPLASH_FETCH_TIMEOUT
                )

                if response.status_code == 200:
                    data = response.json()
                else:
                    print(f"[WARNING] Unsplash API returned status code: {response.status_code}")
                    return None, None

            image_url = data.get("urls", {}).get("regular")
            if not image_url:
                print("[WARNING] No image URL in Unsplash response")
                return None, None

            # Apply rate limiting for image download
            print(f"[DEBUG] Downloading image from: {image_url[:80]}...")
            print(f"[DEBUG] Checking rate limit for image URL...")
            self.rate_limiter.wait_if_needed(image_url)
            print(f"[DEBUG] Rate limit check passed, downloading image...")
            print(f"[DEBUG] Image download timeout: {self.UNSPLASH_FETCH_TIMEOUT}s")

            img_response = requests.get(image_url, timeout=self.UNSPLASH_FETCH_TIMEOUT)
            print(f"[DEBUG] Image response received, status code: {img_response.status_code}")

            if img_response.status_code != 200:
                print(f"[WARNING] Failed to download Unsplash image: {img_response.status_code}")
                return None, None

            metadata = {
                "source": "unsplash",
                "source_name": "Unsplash",
                "search_query": search_query if search_query else "random",
                "id": data.get("id", ""),
                "description": data.get("description") or data.get("alt_description") or "Unsplash image",
                "photographer": data.get("user", {}).get("name", "Unknown"),
                "photographer_username": data.get("user", {}).get("username", ""),
                "photographer_url": data.get("user", {}).get("links", {}).get("html", ""),
                "image_url": data.get("links", {}).get("html", ""),
                "download_url": image_url,
                "width": data.get("width", 0),
                "height": data.get("height", 0),
                "color": data.get("color", ""),
                "likes": data.get("likes", 0),
                "created_at": data.get("created_at", "")
            }

            print(f"[SUCCESS] Fetched Unsplash image: {metadata['description']}")
            return img_response.content, metadata

        except requests.exceptions.Timeout as e:
            print(f"[ERROR] Unsplash API request timed out after {self.UNSPLASH_FETCH_TIMEOUT}s: {str(e)}")
            print(f"[ERROR] This usually means:")
            print(f"[ERROR] - Network connection is slow or blocked")
            print(f"[ERROR] - Unsplash API is down or unreachable")
            print(f"[ERROR] - Firewall or proxy is blocking the request")
            return None, None
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Unsplash API request failed: {str(e)}")
            print(f"[ERROR] This could be due to:")
            print(f"[ERROR] - No internet connection")
            print(f"[ERROR] - DNS resolution failure")
            print(f"[ERROR] - SSL/TLS certificate issues")
            return None, None
        except Exception as e:
            print(f"[ERROR] Unexpected error fetching Unsplash image: {str(e)}")
            import traceback
            print(f"[ERROR] Traceback:")
            traceback.print_exc()
            return None, None

    def _fetch_rpic_image(self) -> Tuple[Optional[bytes], Optional[dict]]:
        """Fetch random photography image from RPic API"""
        try:
            import requests
            # Apply rate limiting
            self.rate_limiter.wait_if_needed(self.RPIC_IMAGE_API)
            response = requests.get(self.RPIC_IMAGE_API, timeout=self.RPIC_FETCH_TIMEOUT, allow_redirects=True)
            if response.status_code == 200:
                metadata = {
                    "source": "rpic",
                    "source_name": "RPic Photography",
                    "description": "Random photography from RPic",
                    "url": self.RPIC_IMAGE_API,
                    "final_url": response.url
                }
                print("[SUCCESS] Fetched RPic image")
                return response.content, metadata
            else:
                print(f"[WARNING] RPic API returned status code: {response.status_code}")
                return None, None
        except Exception as e:
            print(f"[WARNING] Failed to fetch RPic image: {str(e)}")
            return None, None

    def _fetch_ltyuanfang_image(self) -> Tuple[Optional[bytes], Optional[dict]]:
        """Fetch random landscape image from Ltyuanfang API"""
        try:
            import requests
            # Apply rate limiting
            self.rate_limiter.wait_if_needed(self.LTYUANFANG_IMAGE_API)
            response = requests.get(self.LTYUANFANG_IMAGE_API, timeout=self.LTYUANFANG_FETCH_TIMEOUT, allow_redirects=True)
            if response.status_code == 200:
                metadata = {
                    "source": "ltyuanfang",
                    "source_name": "Ltyuanfang Landscape",
                    "description": "Random landscape from Ltyuanfang",
                    "url": self.LTYUANFANG_IMAGE_API,
                    "final_url": response.url
                }
                print("[SUCCESS] Fetched Ltyuanfang image")
                return response.content, metadata
            else:
                print(f"[WARNING] Ltyuanfang API returned status code: {response.status_code}")
                return None, None
        except Exception as e:
            print(f"[WARNING] Failed to fetch Ltyuanfang image: {str(e)}")
            return None, None

    def _fetch_image_from_source(self, source: str) -> Tuple[Optional[bytes], Optional[dict]]:
        """Fetch image from specified source"""
        if source == "unsplash":
            return self._fetch_unsplash_image()
        elif source == "bing":
            return self._fetch_bing_image()
        elif source == "rpic":
            return self._fetch_rpic_image()
        elif source == "ltyuanfang":
            return self._fetch_ltyuanfang_image()
        else:
            print(f"[WARNING] Unknown image source: {source}")
            return None, None

    def _fetch_image_with_fallback(self, preferred_source: str = None, use_random: bool = False) -> Tuple[Optional[bytes], Optional[dict]]:
        """Fetch image with automatic fallback to all available sources

        Args:
            preferred_source: Preferred source to try first (unsplash, bing, rpic, ltyuanfang)
            use_random: If True, randomly shuffle all sources; otherwise try in order

        Returns:
            Tuple of (image_data, metadata) or (None, None) if all sources fail
        """
        import random as rand

        sources = self.ALL_IMAGE_SOURCES.copy()

        if use_random:
            rand.shuffle(sources)
        elif preferred_source and preferred_source in sources:
            sources.remove(preferred_source)
            sources.insert(0, preferred_source)

        print(f"[INFO] Trying sources in order: {', '.join(sources)}")

        for source in sources:
            print(f"[INFO] Attempting to fetch from {source}...")
            image_data, metadata = self._fetch_image_from_source(source)

            if image_data and metadata:
                print(f"[SUCCESS] Successfully fetched image from {source}")
                return image_data, metadata
            else:
                print(f"[WARNING] Failed to fetch from {source}, trying next source...")

        print("[ERROR] All image sources failed")
        return None, None

    def _resize_and_crop_cover(self, image, target_width: int, target_height: int):
        """Resize and crop image to cover target dimensions (like CSS object-fit: cover)

        This ensures the image completely fills the target size without distortion:
        1. Scale the image proportionally so it covers the entire target area
        2. Crop from the center to get exact target dimensions
        """
        from PIL import Image

        orig_width, orig_height = image.size
        target_ratio = target_width / target_height
        orig_ratio = orig_width / orig_height

        if orig_ratio > target_ratio:
            new_height = target_height
            new_width = int(target_height * orig_ratio)
        else:
            new_width = target_width
            new_height = int(target_width / orig_ratio)

        resized = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

        left = (new_width - target_width) // 2
        top = (new_height - target_height) // 2
        right = left + target_width
        bottom = top + target_height

        cropped = resized.crop((left, top, right, bottom))

        print(f"[INFO] Resized from {orig_width}x{orig_height} to {new_width}x{new_height}, cropped to {target_width}x{target_height}")
        return cropped

    def _generate_icon_placeholder(self, width: int, height: int):
        """Generate ICON style placeholder image"""
        from PIL import Image, ImageDraw, ImageFont

        # Create image with light gray background
        image = Image.new('RGB', (width, height), color='#f5f5f5')
        draw = ImageDraw.Draw(image)

        # Draw simple icon shape in center
        min_dimension = min(width, height)
        icon_size = int(min_dimension * 0.5)

        # Center position
        center_x = width // 2
        center_y = height // 2

        # Draw circle icon
        left = center_x - icon_size // 2
        top = center_y - icon_size // 2
        right = center_x + icon_size // 2
        bottom = center_y + icon_size // 2

        draw.ellipse([left, top, right, bottom], fill='#e0e0e0', outline='#bdbdbd', width=2)

        # Draw small image icon inside circle
        inner_size = int(icon_size * 0.4)
        inner_left = center_x - inner_size // 2
        inner_top = center_y - inner_size // 2
        inner_right = center_x + inner_size // 2
        inner_bottom = center_y + inner_size // 2

        # Draw mountain-like shape
        draw.polygon([
            (inner_left, inner_bottom),
            (inner_left + inner_size // 3, inner_top + inner_size // 3),
            (inner_left + inner_size * 2 // 3, inner_top + inner_size // 2),
            (inner_right, inner_bottom)
        ], fill='#9e9e9e')

        # Draw sun
        sun_size = int(inner_size * 0.2)
        sun_x = inner_right - sun_size
        sun_y = inner_top + sun_size
        draw.ellipse([sun_x, sun_y, sun_x + sun_size, sun_y + sun_size], fill='#fdd835')

        return image

    def _generate_white_placeholder(self, width: int, height: int):
        """Generate white placeholder image"""
        from PIL import Image, ImageDraw

        # Create pure white image
        image = Image.new('RGB', (width, height), color='#ffffff')
        draw = ImageDraw.Draw(image)

        # Add subtle gray border
        draw.rectangle([0, 0, width-1, height-1], outline='#e0e0e0', width=1)

        return image

    def _generate_normal_placeholder(self, width: int, height: int):
        """Generate normal placeholder with random source selection and fallback"""
        from PIL import Image
        import io

        print(f"[INFO] Generating REAL PHOTO placeholder with random source: {width}x{height}")
        image_data, metadata = self._fetch_image_with_fallback(use_random=True)

        if image_data and metadata:
            try:
                source_image = Image.open(io.BytesIO(image_data))
                print(f"[SUCCESS] Image loaded from {metadata['source']}: {source_image.size}")

                final_image = self._resize_and_crop_cover(source_image, width, height)
                print(f"[SUCCESS] Image processed successfully")
                return final_image, metadata

            except Exception as e:
                print(f"[ERROR] Failed to process image: {str(e)}")

        print("[FALLBACK] Using white placeholder due to all sources failing")
        return self._generate_white_placeholder(width, height), None

    def _generate_bing_image_placeholder(self, width: int, height: int):
        """Generate placeholder from Bing with automatic fallback to other sources"""
        from PIL import Image
        import io

        print(f"[INFO] Generating BING PHOTO placeholder with fallback: {width}x{height}")
        image_data, metadata = self._fetch_image_with_fallback(preferred_source="bing")

        if image_data and metadata:
            try:
                source_image = Image.open(io.BytesIO(image_data))
                print(f"[SUCCESS] Image loaded from {metadata['source']}: {source_image.size}")

                final_image = self._resize_and_crop_cover(source_image, width, height)
                print(f"[SUCCESS] Image processed successfully")
                return final_image, metadata

            except Exception as e:
                print(f"[ERROR] Failed to process image: {str(e)}")

        print("[FALLBACK] Using white placeholder due to all sources failing")
        return self._generate_white_placeholder(width, height), None

    def _generate_unsplash_image_placeholder(self, width: int, height: int):
        """Generate placeholder from Unsplash with automatic fallback to other sources"""
        from PIL import Image
        import io

        print(f"[INFO] Generating UNSPLASH PHOTO placeholder with fallback: {width}x{height}")
        image_data, metadata = self._fetch_image_with_fallback(preferred_source="unsplash")

        if image_data and metadata:
            try:
                source_image = Image.open(io.BytesIO(image_data))
                print(f"[SUCCESS] Image loaded from {metadata['source']}: {source_image.size}")

                final_image = self._resize_and_crop_cover(source_image, width, height)
                print(f"[SUCCESS] Image processed successfully")
                return final_image, metadata

            except Exception as e:
                print(f"[ERROR] Failed to process image: {str(e)}")

        print("[FALLBACK] Using white placeholder due to all sources failing")
        return self._generate_white_placeholder(width, height), None

    def _generate_unsplash_search_placeholder(self, width: int, height: int, description: str):
        """Generate placeholder by searching Unsplash with description"""
        from PIL import Image
        import io

        print(f"[INFO] Generating UNSPLASH SEARCH placeholder: '{description}' {width}x{height}")

        # Use circuit breaker for API call
        result = self._call_api_with_circuit_breaker(
            'unsplash_search',
            self._fetch_unsplash_image,
            search_query=description
        )

        if result is None:
            print("[FALLBACK] unsplash_search blocked or failed, using white placeholder")
            return self._generate_white_placeholder(width, height), None

        image_data, metadata = result

        if image_data and metadata:
            try:
                source_image = Image.open(io.BytesIO(image_data))
                print(f"[SUCCESS] Image loaded from search: {source_image.size}")

                final_image = self._resize_and_crop_cover(source_image, width, height)
                print(f"[SUCCESS] Image processed successfully")
                return final_image, metadata

            except Exception as e:
                print(f"[ERROR] Failed to process search image: {str(e)}")

        print("[FALLBACK] Using white placeholder due to search failure")
        return self._generate_white_placeholder(width, height), None

    def _generate_placeholder_impl(self, image_path: str, width: int, height: int, placeholder_type: str = "default", description: str = None) -> Tuple[bool, str]:
        """Internal implementation of generate_placeholder (without timeout)"""
        try:
            from PIL import Image, ImageDraw, ImageFont

            is_valid, validation_msg, normalized_path = self._validate_and_normalize_path(image_path)
            if not is_valid:
                return False, validation_msg

            path_obj = Path(normalized_path)
            output_dir = path_obj.parent

            dir_accessible, dir_msg = self._ensure_directory_access(output_dir)
            if not dir_accessible:
                return False, dir_msg

            image_metadata = None

            if placeholder_type == "unsplash_search":
                if not description:
                    return False, "Error: 'unsplash_search' type requires 'description' parameter"
                print(f"[INFO] Generating UNSPLASH SEARCH placeholder: {width}x{height}")
                image, image_metadata = self._generate_unsplash_search_placeholder(width, height, description)
            elif placeholder_type == "unsplash_image":
                print(f"[INFO] Generating UNSPLASH PHOTO placeholder: {width}x{height}")
                image, image_metadata = self._generate_unsplash_image_placeholder(width, height)
            elif placeholder_type == "bing_image":
                print(f"[INFO] Generating BING PHOTO placeholder: {width}x{height}")
                image, image_metadata = self._generate_bing_image_placeholder(width, height)
            elif placeholder_type == "normal":
                print(f"[INFO] Generating REAL PHOTO placeholder (auto-select): {width}x{height}")
                image, image_metadata = self._generate_normal_placeholder(width, height)
            elif placeholder_type == "icon":
                print(f"[INFO] Generating ICON placeholder: {width}x{height}")
                image = self._generate_icon_placeholder(width, height)
            elif placeholder_type == "white":
                print(f"[INFO] Generating WHITE placeholder: {width}x{height}")
                image = self._generate_white_placeholder(width, height)
            else:
                print(f"[INFO] Generating DEFAULT placeholder: {width}x{height}")
                image = self._generate_default_placeholder(width, height, path_obj.name)

            image.save(normalized_path, 'JPEG', quality=90)

            self.database.add_record(
                normalized_path,
                width,
                height,
                path_obj.name,
                placeholder_type,
                image_metadata
            )

            self._generate_directory_metadata_json(output_dir)

            return True, f"Placeholder image generated ({placeholder_type}): {normalized_path}"

        except Exception as e:
            return False, f"Failed to generate placeholder image: {str(e)}"

    def generate_placeholder(self, image_path: str, width: int, height: int, placeholder_type: str = "default", description: str = None) -> Tuple[bool, str]:
        """
        Generate a placeholder image with specified type (WITH 60-SECOND TIMEOUT)

        This method wraps _generate_placeholder_impl with a 60-second timeout protection.
        If generation takes longer than 60 seconds, it will be terminated.

        Args:
            image_path: Path where the placeholder image should be saved
            width: Width of the placeholder image in pixels
            height: Height of the placeholder image in pixels
            placeholder_type: Type of placeholder to generate
            description: Description for searching images (only for unsplash_search type)

        Returns:
            Tuple of (success: bool, message: str)
        """
        from concurrent.futures import ThreadPoolExecutor, TimeoutError
        import time

        GENERATION_TIMEOUT = 60  # 60 seconds total timeout

        print(f"[TIMEOUT] Starting generation with {GENERATION_TIMEOUT}s timeout")
        start_time = time.time()

        try:
            # Execute generation in thread pool with timeout
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(
                    self._generate_placeholder_impl,
                    image_path, width, height, placeholder_type, description
                )

                try:
                    result = future.result(timeout=GENERATION_TIMEOUT)
                    elapsed = time.time() - start_time
                    print(f"[TIMEOUT] [OK] Generation completed in {elapsed:.2f}s")
                    return result

                except TimeoutError:
                    print(f"[TIMEOUT] [TIMEOUT] Generation TIMEOUT after {GENERATION_TIMEOUT}s")
                    print(f"[TIMEOUT] Terminating generation...")

                    # Cancel the future
                    future.cancel()

                    # Return fallback white placeholder
                    print(f"[TIMEOUT] Generating white placeholder as fallback...")
                    return self._generate_placeholder_impl(
                        image_path, width, height, "white", None
                    )

        except Exception as e:
            print(f"[TIMEOUT] [ERROR] Unexpected error in timeout wrapper: {str(e)}")
            return False, f"Failed to generate placeholder (timeout wrapper error): {str(e)}"

    def _generate_directory_metadata_json(self, directory: Path):
        """Generate JSON metadata file for all images in directory"""
        try:
            json_file = directory / "placeholder_images_metadata.json"

            records = self.database.get_records()
            directory_str = str(directory).replace('\\', '/')

            directory_images = []
            for record in records:
                record_dir = str(Path(record["image_path"]).parent).replace('\\', '/')
                if record_dir == directory_str:
                    image_info = {
                        "filename": record["filename"],
                        "file_path": record["image_path"],
                        "width": record["width"],
                        "height": record["height"],
                        "placeholder_type": record.get("placeholder_type", "default"),
                        "created_at": record["created_at"],
                        "file_size": record["file_size"]
                    }

                    if "metadata" in record and record["metadata"]:
                        metadata = record["metadata"]
                        image_info["source"] = metadata.get("source", "unknown")

                        if metadata.get("source") == "unsplash":
                            image_info["description"] = metadata.get("description", "")
                            image_info["photographer"] = metadata.get("photographer", "")
                            image_info["photographer_url"] = metadata.get("photographer_url", "")
                            image_info["unsplash_id"] = metadata.get("id", "")
                            image_info["unsplash_url"] = metadata.get("image_url", "")
                            image_info["color"] = metadata.get("color", "")
                            image_info["likes"] = metadata.get("likes", 0)
                        elif metadata.get("source") == "bing":
                            image_info["description"] = metadata.get("description", "")
                            image_info["source_url"] = metadata.get("url", "")

                    directory_images.append(image_info)

            if directory_images:
                metadata_content = {
                    "directory": str(directory).replace('\\', '/'),
                    "generated_at": datetime.now().isoformat(),
                    "total_images": len(directory_images),
                    "images": directory_images
                }

                with open(json_file, 'w', encoding='utf-8') as f:
                    json.dump(metadata_content, f, indent=2, ensure_ascii=False)

                print(f"[SUCCESS] Generated metadata JSON: {json_file}")

        except Exception as e:
            print(f"[WARNING] Failed to generate directory metadata JSON: {str(e)}")

    def _generate_default_placeholder(self, width: int, height: int, filename: str):
        """Generate default placeholder with text overlay (original behavior)"""
        from PIL import Image, ImageDraw, ImageFont

        # Create image
        image = Image.new('RGB', (width, height), color='#f0f0f0')
        draw = ImageDraw.Draw(image)

        # Prepare text content
        filename_text = filename
        dimension_text = f"{width}x{height}"

        # Smart font sizing with minimum readable size
        MIN_FONT_SIZE = 8
        MAX_FONT_SIZE = 72
        MIN_IMAGE_SIZE_FOR_TEXT = 30

        # Check if image is too small for any text
        if min(width, height) < MIN_IMAGE_SIZE_FOR_TEXT:
            print(f"[INFO] Image too small ({width}x{height}) for text, skipping text rendering")
            should_draw_text = False
        else:
            should_draw_text = True

        if should_draw_text:
            def get_text_dimensions(font_size):
                """Get text dimensions for given font size with proper line height"""
                try:
                    test_font = ImageFont.truetype("arial.ttf", int(font_size))
                except (OSError, IOError):
                    test_font = ImageFont.load_default()

                filename_bbox = draw.textbbox((0, 0), filename_text, font=test_font)
                dimension_bbox = draw.textbbox((0, 0), dimension_text, font=test_font)

                filename_w = filename_bbox[2] - filename_bbox[0]
                filename_h = filename_bbox[3] - filename_bbox[1]
                dimension_w = dimension_bbox[2] - dimension_bbox[0]
                dimension_h = dimension_bbox[3] - dimension_bbox[1]

                max_text_width = max(filename_w, dimension_w)
                line_spacing = max(int(font_size * 0.3), 6)
                total_text_height = filename_h + line_spacing + dimension_h

                return max_text_width, total_text_height, test_font, line_spacing

            # Binary search for optimal font size
            min_size = MIN_FONT_SIZE
            max_size = min(MAX_FONT_SIZE, min(width, height))
            optimal_font_size = min_size
            optimal_font = None
            target_width = width * 0.9
            target_height = height * 0.9
            optimal_line_spacing = 6

            while min_size <= max_size:
                test_size = (min_size + max_size) // 2
                text_width, text_height, test_font, line_spacing = get_text_dimensions(test_size)

                if text_width <= target_width and text_height <= target_height:
                    optimal_font_size = test_size
                    optimal_font = test_font
                    optimal_line_spacing = line_spacing
                    min_size = test_size + 1
                else:
                    max_size = test_size - 1

            font_size = optimal_font_size
            if optimal_font:
                font = optimal_font
            else:
                try:
                    font = ImageFont.truetype("arial.ttf", int(font_size))
                except (OSError, IOError):
                    font = ImageFont.load_default()

            bbox_filename = draw.textbbox((0, 0), filename_text, font=font)
            bbox_dimension = draw.textbbox((0, 0), dimension_text, font=font)

            filename_width = bbox_filename[2] - bbox_filename[0]
            filename_height = bbox_filename[3] - bbox_filename[1]
            dimension_width = bbox_dimension[2] - bbox_dimension[0]
            dimension_height = bbox_dimension[3] - bbox_dimension[1]

            total_text_height = filename_height + optimal_line_spacing + dimension_height
            max_text_width = max(filename_width, dimension_width)

            text_fits_width = max_text_width <= target_width
            text_fits_height = total_text_height <= target_height
            font_is_readable = font_size >= MIN_FONT_SIZE

            if text_fits_width and text_fits_height and font_is_readable:
                filename_x = (width - filename_width) // 2
                filename_y = (height - total_text_height) // 2
                dimension_x = (width - dimension_width) // 2
                dimension_y = filename_y + filename_height + optimal_line_spacing

                padding = max(3, int(font_size * 0.2))

                if padding * 2 < min(width, height) // 4:
                    draw.rectangle([
                        max(0, filename_x - padding), max(0, filename_y - padding),
                        min(width, filename_x + filename_width + padding),
                        min(height, filename_y + filename_height + padding)
                    ], fill='#ffffff', outline='#cccccc')

                    draw.rectangle([
                        max(0, dimension_x - padding), max(0, dimension_y - padding),
                        min(width, dimension_x + dimension_width + padding),
                        min(height, dimension_y + dimension_height + padding)
                    ], fill='#ffffff', outline='#cccccc')

                draw.text((filename_x, filename_y), filename_text, fill='#333333', font=font)
                draw.text((dimension_x, dimension_y), dimension_text, fill='#666666', font=font)
                print(f"[INFO] Text rendered with font size {font_size}")
            else:
                print(f"[INFO] Text too large for {width}x{height} image")
                should_draw_text = False

        if not should_draw_text:
            if min(width, height) >= 20:
                try:
                    corner_font_size = max(8, min(width, height) // 8)
                    corner_font = ImageFont.truetype("arial.ttf", corner_font_size)
                except:
                    corner_font = ImageFont.load_default()

                corner_text = f"{width}x{height}"
                corner_bbox = draw.textbbox((0, 0), corner_text, font=corner_font)
                corner_width = corner_bbox[2] - corner_bbox[0]
                corner_height = corner_bbox[3] - corner_bbox[1]

                if corner_width < width * 0.8 and corner_height < height * 0.3:
                    corner_x = width - corner_width - 5
                    corner_y = height - corner_height - 5

                    draw.rectangle([
                        corner_x - 2, corner_y - 2,
                        corner_x + corner_width + 2, corner_y + corner_height + 2
                    ], fill='#ffffff', outline='#dddddd')

                    draw.text((corner_x, corner_y), corner_text, fill='#666666', font=corner_font)
                    print(f"[INFO] Small corner text rendered for {width}x{height} image")

        # Add border
        draw.rectangle([0, 0, width-1, height-1], outline='#cccccc', width=2)

        return image

    def get_image_dimensions(self, image_path: str) -> Tuple[bool, str, Optional[Tuple[int, int]]]:
        """Get dimensions of an existing image

        Args:
            image_path: Path to the image file

        Returns:
            Tuple of (success: bool, message: str, dimensions: Optional[Tuple[width, height]])
        """
        try:
            from PIL import Image

            # Validate and normalize path
            is_valid, validation_msg, normalized_path = self._validate_and_normalize_path(image_path)
            if not is_valid:
                return False, validation_msg, None

            path_obj = Path(normalized_path)

            # Check if file exists
            if not path_obj.exists():
                return False, f"Image file does not exist: {normalized_path}", None

            # Check if it's a file
            if not path_obj.is_file():
                return False, f"Path is not a file: {normalized_path}", None

            # Open image and get dimensions
            with Image.open(normalized_path) as img:
                width, height = img.size
                print(f"[INFO] Image dimensions: {width}x{height}")
                return True, f"Successfully read image dimensions: {width}x{height}", (width, height)

        except Exception as e:
            return False, f"Failed to read image dimensions: {str(e)}", None

    def replace_image_with_placeholder(self, image_path: str, placeholder_type: str = "unsplash_image",
                                       description: str = None, backup: bool = True) -> Tuple[bool, str]:
        """Replace an existing image with a placeholder of the same dimensions

        Args:
            image_path: Path to the image file to replace
            placeholder_type: Type of placeholder to generate (same as generate_placeholder)
            description: Description for searching images (only for unsplash_search type)
            backup: If True, create a backup of the original image before replacing

        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            from PIL import Image

            # Get original image dimensions
            success, msg, dimensions = self.get_image_dimensions(image_path)
            if not success:
                return False, msg

            width, height = dimensions
            print(f"[INFO] Original image size: {width}x{height}")

            # Validate and normalize path
            is_valid, validation_msg, normalized_path = self._validate_and_normalize_path(image_path)
            if not is_valid:
                return False, validation_msg

            path_obj = Path(normalized_path)

            # Create backup if requested
            if backup:
                backup_path = path_obj.parent / f"{path_obj.stem}_backup{path_obj.suffix}"
                try:
                    import shutil
                    shutil.copy2(normalized_path, backup_path)
                    print(f"[SUCCESS] Backup created: {backup_path}")
                except Exception as e:
                    print(f"[WARNING] Failed to create backup: {e}")

            # Generate placeholder with same dimensions
            temp_path = path_obj.parent / f"{path_obj.stem}_temp{path_obj.suffix}"

            success, msg = self.generate_placeholder(
                str(temp_path),
                width,
                height,
                placeholder_type,
                description
            )

            if not success:
                return False, f"Failed to generate replacement image: {msg}"

            # Replace original image with generated placeholder
            try:
                import shutil
                shutil.move(str(temp_path), normalized_path)
                print(f"[SUCCESS] Image replaced: {normalized_path}")

                backup_note = f" (backup at {backup_path})" if backup else ""
                return True, f"Successfully replaced image with {placeholder_type} placeholder: {normalized_path}{backup_note}"

            except Exception as e:
                # Clean up temp file if replacement failed
                if temp_path.exists():
                    temp_path.unlink()
                return False, f"Failed to replace image file: {str(e)}"

        except Exception as e:
            return False, f"Failed to replace image: {str(e)}"

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

        # Initialize OCR placeholder replacer
        try:
            from ocr_placeholder_replacer import get_replacer
            ocr_replacer = get_replacer()
            print("[SUCCESS] OCR placeholder replacer initialized")
        except Exception as e:
            print(f"[WARNING] OCR replacer initialization failed: {e}")
            print("[WARNING] OCR-based tools will not be available")
            ocr_replacer = None

        @mcp.tool()
        def generate_placeholder(image_path: str, width: int, height: int, placeholder_type: str = "unsplash_image", description: str = None) -> str:
            """Generate a placeholder image with specified type

            REAL PHOTO types generate actual usable images from multiple APIs:
                - "unsplash_search": [BEST FOR AI][REQUIRES description] Search Unsplash by description
                    Example: description="mountain sunset", "city night", "ocean waves"
                    Best for: Specific content needs, themed images, contextual placeholders

                - "unsplash_image": [RECOMMENDED][DEFAULT] Random Unsplash professional photo
                    Auto-fallback: Bing -> RPic -> Ltyuanfang -> white placeholder
                    Best for: High-quality random images, general purpose

                - "bing_image": Random Bing photo with auto-fallback
                    Auto-fallback: Unsplash -> RPic -> Ltyuanfang -> white placeholder
                    Best for: Diverse random images

                - "normal": Random from all 4 sources (Unsplash/Bing/RPic/Ltyuanfang)
                    Auto-fallback: Tries all sources sequentially
                    Best for: Maximum variety

            Image sources:
                - Unsplash: Professional photography (supports search)
                - Bing: Random images
                - RPic: Photography collection
                - Ltyuanfang: Landscape photos

            Smart processing: Images are intelligently scaled and cropped from center (like CSS object-fit: cover)
            Can regenerate: Call repeatedly with same path until satisfied with the result

            BLANK PLACEHOLDER types generate simple placeholders with filename and size overlay:
                - "icon": [BLANK] Simple icon style placeholder
                - "white": [BLANK] Pure white placeholder (not recommended)
                - "default": [BLANK] Gray background placeholder

            RECOMMENDED USAGE:
                - Need specific content: Use "unsplash_search" with description="your description"
                - Need high quality: Use "unsplash_image" (default)
                - Need variety: Use "normal"
                - Need temporary placeholder: Use "icon"

            Args:
                image_path: Full path where the placeholder image should be saved
                width: Width of the placeholder image in pixels
                height: Height of the placeholder image in pixels
                placeholder_type: Type of placeholder (default: "unsplash_image")
                description: Search description (REQUIRED for "unsplash_search" type, ignored for others)
                            Examples: "beach sunset", "mountain landscape", "city skyline at night"

            Returns:
                JSON with success, image path, type, and metadata
                A JSON metadata file (placeholder_images_metadata.json) is auto-generated in the directory

            Examples:
                1. Search for specific image:
                   generate_placeholder("path/to/image.jpg", 800, 600, "unsplash_search", "mountain sunset")

                2. Random high-quality image (recommended):
                   generate_placeholder("path/to/image.jpg", 800, 600, "unsplash_image")

                3. Random from all sources:
                   generate_placeholder("path/to/image.jpg", 800, 600, "normal")
            """
            try:
                print(f"[TOOL] generate_placeholder called: {image_path}, {width}x{height}, type={placeholder_type}, description={description}")
                success, message = placeholder_server.generate_placeholder(image_path, width, height, placeholder_type, description)

                if success:
                    result = {
                        "success": True,
                        "message": message,
                        "image_path": image_path,
                        "dimensions": f"{width}x{height}",
                        "placeholder_type": placeholder_type
                    }
                    if description:
                        result["search_description"] = description
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
        def get_image_size(image_path: str) -> str:
            """Get the dimensions (width and height) of an existing image

            This tool reads an image file and returns its dimensions without modifying it.
            Useful for:
            - Checking image size before processing
            - Validating image dimensions
            - Planning replacement operations

            Args:
                image_path: Full path to the image file

            Returns:
                JSON with success status, image dimensions, and file info
            """
            try:
                print(f"[TOOL] get_image_size called: {image_path}")
                success, message, dimensions = placeholder_server.get_image_dimensions(image_path)

                if success and dimensions:
                    width, height = dimensions
                    result = {
                        "success": True,
                        "message": message,
                        "image_path": image_path,
                        "width": width,
                        "height": height,
                        "dimensions": f"{width}x{height}",
                        "aspect_ratio": round(width / height, 2) if height > 0 else 0
                    }
                else:
                    result = {"success": False, "error": message}

                print(f"[SUCCESS] get_image_size completed")
                return json.dumps(result, indent=2)

            except Exception as e:
                error_result = {"error": f"Failed to get image size: {str(e)}"}
                print(f"[ERROR] get_image_size failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def replace_image(image_path: str, placeholder_type: str = "unsplash_image",
                         description: str = None, backup: bool = True) -> str:
            """Replace an existing image with a placeholder while preserving original dimensions

            This tool:
            1. Reads the dimensions of the existing image
            2. Generates a new placeholder image with the same dimensions
            3. Optionally creates a backup of the original image
            4. Replaces the original image with the new placeholder

            Use cases:
            - Replace low-quality images with high-quality placeholders
            - Refresh placeholder images with new content
            - Update images while maintaining layout (same size)
            - Batch replace images in a project

            PLACEHOLDER TYPES (same as generate_placeholder):
                - "unsplash_search": Search Unsplash by description (requires 'description')
                - "unsplash_image": Random Unsplash photo (default, recommended)
                - "bing_image": Random Bing photo
                - "normal": Random from all sources
                - "icon": Simple icon placeholder
                - "white": White placeholder
                - "default": Gray placeholder

            Args:
                image_path: Full path to the image file to replace
                placeholder_type: Type of placeholder (default: "unsplash_image")
                description: Search description (required for "unsplash_search")
                backup: Create backup before replacing (default: True)

            Returns:
                JSON with success status, replacement info, and backup location

            Examples:
                1. Replace with random high-quality photo:
                   replace_image("path/to/image.jpg")

                2. Replace with specific content:
                   replace_image("path/to/image.jpg", "unsplash_search", "sunset beach")

                3. Replace without backup:
                   replace_image("path/to/image.jpg", "unsplash_image", None, False)
            """
            try:
                print(f"[TOOL] replace_image called: {image_path}, type={placeholder_type}, backup={backup}")
                success, message = placeholder_server.replace_image_with_placeholder(
                    image_path, placeholder_type, description, backup
                )

                if success:
                    result = {
                        "success": True,
                        "message": message,
                        "image_path": image_path,
                        "placeholder_type": placeholder_type,
                        "backup_created": backup
                    }
                    if description:
                        result["search_description"] = description
                else:
                    result = {"success": False, "error": message}

                print(f"[SUCCESS] replace_image completed")
                return json.dumps(result, indent=2)

            except Exception as e:
                error_result = {"error": f"Failed to replace image: {str(e)}"}
                print(f"[ERROR] replace_image failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def scan_directory_for_placeholders(directory: str, recursive: bool = True, use_ocr: bool = True) -> str:
            """Scan directory for placeholder images using OCR detection

            This tool scans a directory for placeholder images by:
            1. Finding all image files (jpg, png, gif, etc.)
            2. Using OCR to read text from images
            3. Looking for size patterns (e.g., "300x200", "400x300")
            4. Looking for format keywords (e.g., "PNG", "JPG")
            5. Detecting common placeholder characteristics

            Use cases:
                - Identify placeholder images in a project directory
                - Audit placeholder usage before replacement
                - Verify which images need updating
                - Generate report of placeholder locations

            Args:
                directory: Directory path to scan
                recursive: If True, scan subdirectories (default: True)
                use_ocr: If True, use OCR for detection (default: True)

            Returns:
                JSON with scan results including list of detected placeholders

            Examples:
                1. Scan current directory:
                   scan_directory_for_placeholders("D:/project/images")

                2. Scan without recursion:
                   scan_directory_for_placeholders("D:/project/images", False)

                3. Quick scan without OCR (only file size/dimension check):
                   scan_directory_for_placeholders("D:/project/images", True, False)
            """
            try:
                print(f"[TOOL] scan_directory_for_placeholders called: {directory}")

                if ocr_replacer is None:
                    return json.dumps({
                        "success": False,
                        "error": "OCR replacer not initialized. Check server logs."
                    }, indent=2)

                # Perform scan
                placeholders = ocr_replacer.scan_directory(
                    directory=directory,
                    recursive=recursive,
                    use_ocr=use_ocr
                )

                result = {
                    "success": True,
                    "directory": directory,
                    "recursive": recursive,
                    "use_ocr": use_ocr,
                    "found_placeholders": len(placeholders),
                    "placeholders": placeholders
                }

                print(f"[SUCCESS] scan_directory_for_placeholders completed - found {len(placeholders)} placeholders")
                return json.dumps(result, indent=2)

            except Exception as e:
                error_result = {"error": f"Failed to scan directory: {str(e)}"}
                print(f"[ERROR] scan_directory_for_placeholders failed: {e}")
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def replace_directory_placeholders(directory: str, placeholder_type: str = "unsplash_image",
                                          description: str = None, recursive: bool = True,
                                          use_ocr: bool = True, dry_run: bool = False) -> str:
            """Batch replace placeholder images in a directory using OCR detection

            This tool:
            1. Scans directory for placeholder images using OCR
            2. Detects placeholders by looking for size patterns and keywords
            3. Queues detected placeholders for replacement
            4. Processes queue with rate limiting (5 second intervals)
            5. Intelligently skips duplicate images (by hash)
            6. Generates high-quality replacements maintaining original dimensions

            Use cases:
                - Batch update all placeholders in a project
                - Replace development placeholders with production images
                - Refresh placeholder content while maintaining layout
                - Convert mockup images to real photos

            RECOMMENDED: Just use default settings (no placeholder_type needed)
                - Default "unsplash_image" automatically tries multiple APIs:
                  Unsplash → Bing → RPic → Ltyuanfang (random high-quality photos)
                - Only specify placeholder_type if you need specific content:
                  "unsplash_search" with description for themed images

            PLACEHOLDER TYPES (optional, rarely needed):
                - "unsplash_image": [DEFAULT] Random from multiple APIs with auto-fallback
                - "unsplash_search": Search Unsplash by description (requires 'description')
                - "normal": Random from all sources (same as default)
                - "icon": Simple icon placeholder
                - "white": White placeholder
                - "default": Gray placeholder

            Args:
                directory: Directory to scan and replace
                placeholder_type: [OPTIONAL] Type of placeholder (default: "unsplash_image" = random high-quality)
                description: [OPTIONAL] Search description (only for "unsplash_search" type)
                recursive: Scan subdirectories (default: True)
                use_ocr: Use OCR for detection (default: True)
                dry_run: Only detect, don't replace (default: False)

            Returns:
                JSON with batch replacement results

            Examples:
                1. SIMPLEST - Replace all placeholders with random high-quality photos:
                   replace_directory_placeholders("D:/project/images")
                   (No placeholder_type needed! Auto-tries Unsplash→Bing→RPic→Ltyuanfang)

                2. Dry run to see what would be replaced:
                   replace_directory_placeholders("D:/project/images", dry_run=True)

                3. Replace with SPECIFIC themed content:
                   replace_directory_placeholders("D:/project/images", "unsplash_search", "nature landscape")

                4. Non-recursive (current directory only):
                   replace_directory_placeholders("D:/project/images", recursive=False)
            """
            try:
                print(f"[TOOL] replace_directory_placeholders called: {directory}")

                if ocr_replacer is None:
                    return json.dumps({
                        "success": False,
                        "error": "OCR replacer not initialized. Check server logs."
                    }, indent=2)

                # Perform replacement
                result = ocr_replacer.replace_placeholders_in_directory(
                    directory=directory,
                    placeholder_type=placeholder_type,
                    description=description,
                    recursive=recursive,
                    use_ocr=use_ocr,
                    dry_run=dry_run
                )

                print(f"[SUCCESS] replace_directory_placeholders completed")
                return json.dumps(result, indent=2)

            except Exception as e:
                error_result = {"error": f"Failed to replace placeholders: {str(e)}"}
                print(f"[ERROR] replace_directory_placeholders failed: {e}")
                import traceback
                traceback.print_exc()
                return json.dumps(error_result, indent=2)

        @mcp.tool()
        def replace_single_placeholder_with_ocr(image_path: str, placeholder_type: str = "unsplash_image",
                                               description: str = None, use_ocr: bool = True,
                                               force: bool = False) -> str:
            """Replace a single image using OCR detection to verify it's a placeholder

            This tool:
            1. Uses OCR to detect if the image is a placeholder
            2. Checks for size patterns (e.g., "300x200") and format keywords
            3. Only replaces if detected as placeholder (unless force=True)
            4. Maintains original image dimensions
            5. Generates high-quality replacement from multiple APIs

            Difference from replace_image:
                - This tool uses OCR to verify placeholder before replacing
                - Safer for batch operations (won't replace non-placeholders)
                - Can force replacement even if not detected as placeholder

            Use cases:
                - Safe replacement of suspected placeholder images
                - Verify and replace individual placeholders
                - Selective image updates with OCR validation
                - Replace images containing text indicators

            RECOMMENDED: Just provide the image path (no placeholder_type needed)
                - Default automatically tries: Unsplash → Bing → RPic → Ltyuanfang
                - Gets random high-quality photos until one succeeds

            Args:
                image_path: Full path to the image file
                placeholder_type: [OPTIONAL] Type (default: "unsplash_image" = random multi-API)
                description: [OPTIONAL] Search description (only for "unsplash_search" type)
                use_ocr: Use OCR to verify placeholder (default: True)
                force: Replace even if not detected as placeholder (default: False)

            Returns:
                JSON with replacement result and OCR detection details

            Examples:
                1. SIMPLEST - Verify and replace with random high-quality photo:
                   replace_single_placeholder_with_ocr("D:/project/image.jpg")
                   (Auto-tries multiple APIs for best quality!)

                2. Force replacement (skip OCR verification):
                   replace_single_placeholder_with_ocr("D:/project/image.jpg", force=True)

                3. Replace with SPECIFIC themed content:
                   replace_single_placeholder_with_ocr("D:/project/image.jpg", "unsplash_search", "sunset beach")
            """
            try:
                print(f"[TOOL] replace_single_placeholder_with_ocr called: {image_path}")

                if ocr_replacer is None:
                    return json.dumps({
                        "success": False,
                        "error": "OCR replacer not initialized. Check server logs."
                    }, indent=2)

                # Detect if placeholder using OCR
                detection = ocr_replacer.detector.detect_placeholder(image_path, use_ocr=use_ocr)

                result = {
                    "image_path": image_path,
                    "detection": {
                        "is_placeholder": detection.is_placeholder,
                        "confidence": detection.confidence,
                        "detected_size": detection.detected_size,
                        "detected_format": detection.detected_format,
                        "ocr_text": detection.ocr_text,
                        "reason": detection.reason
                    }
                }

                # Check if should replace
                if not detection.is_placeholder and not force:
                    result["success"] = False
                    result["message"] = "Image not detected as placeholder. Use force=True to replace anyway."
                    print("[INFO] Image not detected as placeholder, skipping replacement")
                    return json.dumps(result, indent=2)

                # Get image dimensions
                from PIL import Image
                try:
                    with Image.open(image_path) as img:
                        width, height = img.size
                except Exception as e:
                    result["success"] = False
                    result["error"] = f"Failed to read image: {str(e)}"
                    return json.dumps(result, indent=2)

                # Generate replacement
                print(f"[INFO] Replacing placeholder: {width}x{height}")
                success, message = placeholder_server.generate_placeholder(
                    image_path,
                    width=width,
                    height=height,
                    placeholder_type=placeholder_type,
                    description=description or detection.ocr_text
                )

                result["success"] = success
                result["message"] = message
                result["width"] = width
                result["height"] = height
                result["placeholder_type"] = placeholder_type

                if success:
                    print(f"[SUCCESS] replace_single_placeholder_with_ocr completed")
                else:
                    print(f"[WARNING] Replacement failed: {message}")

                return json.dumps(result, indent=2)

            except Exception as e:
                error_result = {"error": f"Failed to replace placeholder: {str(e)}"}
                print(f"[ERROR] replace_single_placeholder_with_ocr failed: {e}")
                import traceback
                traceback.print_exc()
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
                        "requests": "available"
                    },
                    "placeholder_types": {
                        "unsplash_search": "[BEST FOR AI][REAL PHOTO] Search Unsplash by description (requires 'description' parameter)",
                        "unsplash_image": "[RECOMMENDED][REAL PHOTO] Random Unsplash with auto-fallback (default)",
                        "bing_image": "[REAL PHOTO] Random Bing with auto-fallback",
                        "normal": "[REAL PHOTO] Random from 4 sources with auto-fallback",
                        "icon": "[BLANK PLACEHOLDER] Simple icon style",
                        "white": "[BLANK PLACEHOLDER] Pure white (not recommended)",
                        "default": "[BLANK PLACEHOLDER] Gray background"
                    },
                    "image_sources": {
                        "unsplash": "Unsplash - Professional photography (supports search and random)",
                        "bing": "Bing - Random images",
                        "rpic": "RPic - Photography collection",
                        "ltyuanfang": "Ltyuanfang - Landscape photos"
                    },
                    "features": [
                        "Description-based search: Search Unsplash using keywords (e.g., 'mountain sunset', 'city night')",
                        "Smart cover-crop: Images scaled and cropped from center (no distortion)",
                        "Auto-fallback: Tries all 4 sources sequentially on failure",
                        "Regenerable: Can call repeatedly until satisfied",
                        "Metadata: Auto-generates JSON file for AI processing"
                    ],
                    "usage_recommendations": {
                        "need_specific_content": "Use 'unsplash_search' with description parameter",
                        "need_high_quality": "Use 'unsplash_image' for random professional photos",
                        "need_variety": "Use 'normal' to get diverse images from multiple sources",
                        "need_simple_placeholder": "Use 'icon' or 'default' for temporary placeholders"
                    },
                    "capabilities": [
                        "generate_placeholder",
                        "get_image_size",
                        "replace_image",
                        "list_placeholders",
                        "check_path_access",
                        "scan_directory_for_placeholders",
                        "replace_directory_placeholders",
                        "replace_single_placeholder_with_ocr",
                        "health_check"
                    ],
                    "ocr_features": {
                        "available": ocr_replacer is not None,
                        "description": "OCR-based placeholder detection and batch replacement",
                        "capabilities": [
                            "Scan directories for placeholder images using OCR",
                            "Detect size patterns (e.g., 300x200) in image text",
                            "Detect format keywords (PNG, JPG, etc.)",
                            "Batch replace with rate limiting",
                            "Intelligent duplicate detection",
                            "Safe replacement with OCR verification"
                        ] if ocr_replacer is not None else []
                    }
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