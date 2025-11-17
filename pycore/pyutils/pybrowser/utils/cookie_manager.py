#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cookie Manager - Persistent Cookie Storage

Provides cookie persistence with multiple profile support:
- Save/load cookies from disk
- Real-time cookie updates
- Multiple cookie profiles (sessions)
- Auto-load on browser start
- Load strategies: default, latest, specified
"""

import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime

from pycore import ColorPrint
from pycore.pyfoundations.system_paths import map_web_path


LoadStrategy = Literal['default', 'latest', 'specified', 'none']
SaveStrategy = Literal['default', 'new', 'specified']


class CookieManager:
    """
    Cookie persistence manager with real-time updates

    Features:
    - Multiple cookie profiles (sessions)
    - Real-time cookie saving
    - Load strategies: default, latest, specified
    - Save strategies: default, new, specified
    - Metadata tracking (timestamps, browser info)
    - Session/Persistent cookie separation

    Usage:
        # Initialize
        manager = CookieManager()

        # Load default cookies
        cookies = manager.load_cookies()

        # Load latest cookies (persistent only by default)
        cookies = manager.load_cookies(strategy='latest', include_session=False)

        # Save cookies (auto-separate session/persistent)
        manager.save_cookies(cookies, strategy='default')

        # Create new session
        manager.save_cookies(cookies, strategy='new', profile_name='session1')
    """

    def __init__(self, storage_dir: Optional[Path] = None):
        """
        Initialize Cookie Manager

        Args:
            storage_dir: Custom storage directory (default: wwwr/pycore_db/cookies/)
        """
        if storage_dir:
            self.storage_dir = Path(storage_dir)
        else:
            # Use map_web_path to get wwwr/pycore_db/cookies/
            base_path = map_web_path('www', 'pycore_db')
            self.storage_dir = base_path / 'cookies'

        # Create storage directory
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        # Default profile name
        self.default_profile = 'default'

        # Current active profile (for real-time updates)
        self.active_profile: Optional[str] = None

        ColorPrint.blue(f"CookieManager initialized: {self.storage_dir}")

    def _get_profile_path(self, profile_name: str) -> Path:
        """
        Get file path for cookie profile

        Args:
            profile_name: Profile name

        Returns:
            Path to cookie file
        """
        # Sanitize profile name
        safe_name = profile_name.replace('/', '_').replace('\\', '_')
        return self.storage_dir / f"{safe_name}.json"

    def _get_metadata_path(self, profile_name: str) -> Path:
        """
        Get metadata file path for cookie profile

        Args:
            profile_name: Profile name

        Returns:
            Path to metadata file
        """
        safe_name = profile_name.replace('/', '_').replace('\\', '_')
        return self.storage_dir / f"{safe_name}.meta.json"

    def _separate_cookies(self, cookies: List[Dict[str, Any]]) -> tuple[List[Dict], List[Dict]]:
        """
        Separate cookies into session and persistent cookies

        Args:
            cookies: List of cookie dictionaries

        Returns:
            Tuple of (session_cookies, persistent_cookies)
        """
        session_cookies = []
        persistent_cookies = []

        for cookie in cookies:
            # Session cookie: no 'expiry' or 'expires' field
            # Note: Selenium uses 'expiry', browser's document.cookie uses 'expires'
            if 'expiry' in cookie or 'expires' in cookie:
                persistent_cookies.append(cookie)
            else:
                session_cookies.append(cookie)

        return session_cookies, persistent_cookies

    def save_cookies(
        self,
        cookies: List[Dict[str, Any]],
        strategy: SaveStrategy = 'default',
        profile_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        save_session_cookies: bool = True
    ) -> str:
        """
        Save cookies to disk with strategy

        Args:
            cookies: List of cookie dictionaries
            strategy: Save strategy
                - 'default': Save to default profile (overwrite)
                - 'new': Create new profile with timestamp
                - 'specified': Save to specified profile name
            profile_name: Profile name (required for 'specified' strategy)
            metadata: Additional metadata to store
            save_session_cookies: Whether to save session cookies (default: True)
                                  If False, only persistent cookies are saved

        Returns:
            Profile name that was saved to
        """
        # Determine target profile
        if strategy == 'default':
            target_profile = self.default_profile
        elif strategy == 'new':
            # Generate new profile name with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            target_profile = f"session_{timestamp}"
        elif strategy == 'specified':
            if not profile_name:
                raise ValueError("profile_name is required for 'specified' strategy")
            target_profile = profile_name
        else:
            raise ValueError(f"Invalid save strategy: {strategy}")

        # Separate session and persistent cookies
        session_cookies, persistent_cookies = self._separate_cookies(cookies)

        # Prepare cookie data (separated storage)
        cookie_data = {
            'persistent_cookies': persistent_cookies,
            'session_cookies': session_cookies if save_session_cookies else [],
            'total_count': len(cookies),
            'persistent_count': len(persistent_cookies),
            'session_count': len(session_cookies),
            'session_saved': save_session_cookies,
            'saved_at': datetime.now().isoformat(),
            'strategy': strategy
        }

        # Save cookies
        profile_path = self._get_profile_path(target_profile)
        with open(profile_path, 'w', encoding='utf-8') as f:
            json.dump(cookie_data, f, indent=2, ensure_ascii=False)

        # Save metadata
        meta_data = {
            'profile_name': target_profile,
            'cookie_count': len(cookies),
            'persistent_count': len(persistent_cookies),
            'session_count': len(session_cookies),
            'session_saved': save_session_cookies,
            'created_at': datetime.now().isoformat(),
            'last_updated': datetime.now().isoformat(),
            'strategy': strategy,
            **(metadata or {})
        }

        meta_path = self._get_metadata_path(target_profile)
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta_data, f, indent=2, ensure_ascii=False)

        # Set as active profile for real-time updates
        self.active_profile = target_profile

        ColorPrint.green(
            f"Saved cookies to profile: {target_profile} "
            f"(persistent: {len(persistent_cookies)}, session: {len(session_cookies)}, "
            f"session_saved: {save_session_cookies}, strategy: {strategy})"
        )

        return target_profile

    def load_cookies(
        self,
        strategy: LoadStrategy = 'default',
        profile_name: Optional[str] = None,
        include_session: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Load cookies from disk with strategy

        Args:
            strategy: Load strategy
                - 'default': Load default profile
                - 'latest': Load most recently updated profile
                - 'specified': Load specified profile name
                - 'none': Don't load any cookies
            profile_name: Profile name (required for 'specified' strategy)
            include_session: Whether to load session cookies (default: False)
                            If False, only persistent cookies are loaded

        Returns:
            List of cookie dictionaries
        """
        if strategy == 'none':
            ColorPrint.blue("Load strategy is 'none', skipping cookie loading")
            return []

        # Determine source profile
        if strategy == 'default':
            source_profile = self.default_profile
        elif strategy == 'latest':
            source_profile = self._find_latest_profile()
            if not source_profile:
                ColorPrint.yellow("No cookie profiles found, using default")
                source_profile = self.default_profile
        elif strategy == 'specified':
            if not profile_name:
                raise ValueError("profile_name is required for 'specified' strategy")
            source_profile = profile_name
        else:
            raise ValueError(f"Invalid load strategy: {strategy}")

        # Load cookies
        profile_path = self._get_profile_path(source_profile)

        if not profile_path.exists():
            ColorPrint.yellow(f"Cookie profile not found: {source_profile}")
            return []

        try:
            with open(profile_path, 'r', encoding='utf-8') as f:
                cookie_data = json.load(f)

            # Support both old format (cookies array) and new format (separated)
            if 'persistent_cookies' in cookie_data:
                # New format: separated cookies
                persistent_cookies = cookie_data.get('persistent_cookies', [])
                session_cookies = cookie_data.get('session_cookies', [])

                if include_session:
                    cookies = persistent_cookies + session_cookies
                else:
                    cookies = persistent_cookies

                saved_at = cookie_data.get('saved_at', 'unknown')

                ColorPrint.green(
                    f"Loaded cookies from profile: {source_profile} "
                    f"(persistent: {len(persistent_cookies)}, session: {len(session_cookies)}, "
                    f"loaded: {len(cookies)}, include_session: {include_session}, "
                    f"saved: {saved_at}, strategy: {strategy})"
                )
            else:
                # Old format: all cookies in 'cookies' array
                cookies = cookie_data.get('cookies', [])

                # Filter by session/persistent if using old format
                if not include_session:
                    # Only keep persistent cookies
                    _, persistent_only = self._separate_cookies(cookies)
                    original_count = len(cookies)
                    cookies = persistent_only
                    ColorPrint.yellow(
                        f"Legacy format detected. Filtered {original_count} -> {len(cookies)} cookies "
                        f"(persistent only)"
                    )

                saved_at = cookie_data.get('saved_at', 'unknown')

                ColorPrint.green(
                    f"Loaded {len(cookies)} cookies from profile: {source_profile} "
                    f"(saved: {saved_at}, strategy: {strategy})"
                )

            # Set as active profile
            self.active_profile = source_profile

            return cookies

        except Exception as e:
            ColorPrint.red(f"Failed to load cookies from {source_profile}: {e}")
            return []

    def update_cookies_realtime(self, cookies: List[Dict[str, Any]], save_session_cookies: bool = True) -> bool:
        """
        Update cookies in real-time (save to active profile)

        Args:
            cookies: Current cookie list
            save_session_cookies: Whether to save session cookies (default: True)

        Returns:
            True if successful
        """
        if not self.active_profile:
            ColorPrint.yellow("No active profile, skipping real-time update")
            return False

        try:
            # Separate session and persistent cookies
            session_cookies, persistent_cookies = self._separate_cookies(cookies)

            # Update cookies without changing metadata
            profile_path = self._get_profile_path(self.active_profile)

            # Load existing data to preserve metadata
            if profile_path.exists():
                with open(profile_path, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
            else:
                existing_data = {}

            # Update with new format (separated cookies)
            existing_data['persistent_cookies'] = persistent_cookies
            existing_data['session_cookies'] = session_cookies if save_session_cookies else []
            existing_data['total_count'] = len(cookies)
            existing_data['persistent_count'] = len(persistent_cookies)
            existing_data['session_count'] = len(session_cookies)
            existing_data['session_saved'] = save_session_cookies
            existing_data['last_updated'] = datetime.now().isoformat()

            # Save
            with open(profile_path, 'w', encoding='utf-8') as f:
                json.dump(existing_data, f, indent=2, ensure_ascii=False)

            # Update metadata timestamp
            meta_path = self._get_metadata_path(self.active_profile)
            if meta_path.exists():
                with open(meta_path, 'r', encoding='utf-8') as f:
                    meta_data = json.load(f)

                meta_data['last_updated'] = datetime.now().isoformat()
                meta_data['cookie_count'] = len(cookies)
                meta_data['persistent_count'] = len(persistent_cookies)
                meta_data['session_count'] = len(session_cookies)
                meta_data['session_saved'] = save_session_cookies

                with open(meta_path, 'w', encoding='utf-8') as f:
                    json.dump(meta_data, f, indent=2, ensure_ascii=False)

            return True

        except Exception as e:
            ColorPrint.red(f"Failed to update cookies in real-time: {e}")
            return False

    def _find_latest_profile(self) -> Optional[str]:
        """
        Find the most recently updated cookie profile

        Returns:
            Profile name or None if no profiles exist
        """
        profiles = self.list_profiles()

        if not profiles:
            return None

        # Get modification times
        profile_times = []
        for profile in profiles:
            profile_path = self._get_profile_path(profile)
            if profile_path.exists():
                mtime = profile_path.stat().st_mtime
                profile_times.append((profile, mtime))

        if not profile_times:
            return None

        # Sort by modification time (most recent first)
        profile_times.sort(key=lambda x: x[1], reverse=True)

        return profile_times[0][0]

    def list_profiles(self) -> List[str]:
        """
        List all available cookie profiles

        Returns:
            List of profile names
        """
        profiles = []

        for file_path in self.storage_dir.glob('*.json'):
            # Skip metadata files
            if '.meta.' in file_path.name:
                continue

            # Extract profile name
            profile_name = file_path.stem
            profiles.append(profile_name)

        return sorted(profiles)

    def get_profile_info(self, profile_name: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata information about a profile

        Args:
            profile_name: Profile name

        Returns:
            Metadata dictionary or None
        """
        meta_path = self._get_metadata_path(profile_name)

        if not meta_path.exists():
            return None

        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            ColorPrint.red(f"Failed to read profile metadata: {e}")
            return None

    def delete_profile(self, profile_name: str) -> bool:
        """
        Delete a cookie profile

        Args:
            profile_name: Profile name

        Returns:
            True if successful
        """
        if profile_name == self.default_profile:
            ColorPrint.yellow(f"Cannot delete default profile: {profile_name}")
            return False

        profile_path = self._get_profile_path(profile_name)
        meta_path = self._get_metadata_path(profile_name)

        deleted = False

        if profile_path.exists():
            profile_path.unlink()
            deleted = True

        if meta_path.exists():
            meta_path.unlink()

        if deleted:
            ColorPrint.green(f"Deleted profile: {profile_name}")

            # Clear active profile if it was deleted
            if self.active_profile == profile_name:
                self.active_profile = None

        return deleted

    def merge_cookies(
        self,
        cookies1: List[Dict[str, Any]],
        cookies2: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Merge two cookie lists (deduplicate by name+domain)

        Args:
            cookies1: First cookie list
            cookies2: Second cookie list (takes precedence)

        Returns:
            Merged cookie list
        """
        # Use dict to deduplicate by (name, domain)
        merged = {}

        for cookie in cookies1:
            key = (cookie.get('name'), cookie.get('domain'))
            merged[key] = cookie

        # cookies2 overwrites cookies1
        for cookie in cookies2:
            key = (cookie.get('name'), cookie.get('domain'))
            merged[key] = cookie

        return list(merged.values())

    def cleanup_old_profiles(self, keep_count: int = 10) -> int:
        """
        Clean up old cookie profiles (keep most recent)

        Args:
            keep_count: Number of profiles to keep

        Returns:
            Number of profiles deleted
        """
        profiles = self.list_profiles()

        # Always keep default profile
        if self.default_profile in profiles:
            profiles.remove(self.default_profile)

        if len(profiles) <= keep_count:
            return 0

        # Get modification times
        profile_times = []
        for profile in profiles:
            profile_path = self._get_profile_path(profile)
            if profile_path.exists():
                mtime = profile_path.stat().st_mtime
                profile_times.append((profile, mtime))

        # Sort by modification time (oldest first)
        profile_times.sort(key=lambda x: x[1])

        # Delete oldest profiles
        delete_count = len(profile_times) - keep_count
        deleted = 0

        for i in range(delete_count):
            profile_name = profile_times[i][0]
            if self.delete_profile(profile_name):
                deleted += 1

        if deleted > 0:
            ColorPrint.green(f"Cleaned up {deleted} old cookie profiles")

        return deleted

    def export_profile(self, profile_name: str, export_path: Path) -> bool:
        """
        Export cookie profile to external file

        Args:
            profile_name: Profile name
            export_path: Export file path

        Returns:
            True if successful
        """
        profile_path = self._get_profile_path(profile_name)

        if not profile_path.exists():
            ColorPrint.red(f"Profile not found: {profile_name}")
            return False

        try:
            import shutil
            shutil.copy2(profile_path, export_path)
            ColorPrint.green(f"Exported profile {profile_name} to: {export_path}")
            return True
        except Exception as e:
            ColorPrint.red(f"Failed to export profile: {e}")
            return False

    def import_profile(self, import_path: Path, profile_name: str) -> bool:
        """
        Import cookie profile from external file

        Args:
            import_path: Import file path
            profile_name: Target profile name

        Returns:
            True if successful
        """
        if not import_path.exists():
            ColorPrint.red(f"Import file not found: {import_path}")
            return False

        try:
            # Validate JSON format
            with open(import_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if 'cookies' not in data:
                ColorPrint.red("Invalid cookie file format (missing 'cookies' key)")
                return False

            # Save as new profile
            cookies = data['cookies']
            metadata = {
                'imported_from': str(import_path),
                'original_saved_at': data.get('saved_at')
            }

            self.save_cookies(cookies, strategy='specified',
                            profile_name=profile_name, metadata=metadata)

            return True

        except Exception as e:
            ColorPrint.red(f"Failed to import profile: {e}")
            return False
