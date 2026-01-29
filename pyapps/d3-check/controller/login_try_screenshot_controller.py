#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Login Try Screenshot Controller
When "Login try" in log: capture Battle.net window, OCR for Retry/重试;
if found (disconnect), restart Battle.net.exe via taskkill + explorer (no threading).
Also captures full-screen screenshot on demand.
"""

import os
import sys
import subprocess
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
cv2 = get_third_package_cv2()
np = get_third_package_numpy()

from providor.common_imports import ColorPrint, CnOCREngine, ClickHandler, ImageMatcher
from providor.providor_index import (
    CONFIG,
    BATTLE_NET_WINDOW_TITLES,
    BATTLENET_TEMPLATE_CONFIGS,
    TEMPLATE_DIR,
    BATTLENET_STANDARD_RESOLUTION_WIDTH,
    BATTLENET_STANDARD_RESOLUTION_HEIGHT,
)
from config.constants import (
    LOGIN_TRY_SCREENSHOT_DIR,
    LOGIN_TRY_SCREENSHOT_PREFIX,
    BATTLE_NET_DISCONNECT_KEYWORDS,
    BATTLE_NET_NEED_LOGIN_KEYWORDS,
    BATTLE_NET_EXE_NAME,
    BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME,
    BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME,
    BATTLE_NET_PLAY_BUTTON_TEMPLATE_NAMES,
)
from d3utils.screenshot_provider import get_screenshot_provider


class LoginTryScreenshotController:
    """
    On "Login try": capture Battle.net window, OCR for Retry/重试; if disconnect, restart Battle.net.
    Also captures full-screen screenshot on demand.
    """

    def __init__(self):
        self.screenshot_provider = get_screenshot_provider()
        self._ocr_engine: Optional[CnOCREngine] = None
        LOGIN_TRY_SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        self._ensure_d3_small_map_template()
        ColorPrint.blue("[LoginTryScreenshotController] Initialized")

    def _ensure_d3_small_map_template(self) -> None:
        """If d3_small_map.png template does not exist, copy from ScreenShot_2026-01-29_225845_569.png (screenshot dir or images/)."""
        cfg = BATTLENET_TEMPLATE_CONFIGS.get(BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME)
        if not cfg:
            return
        dest_path = Path(cfg["path"])
        if dest_path.exists():
            return
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        for candidate_dir in (LOGIN_TRY_SCREENSHOT_DIR, Path(TEMPLATE_DIR)):
            src_path = candidate_dir / BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME
            if src_path.exists():
                import shutil
                shutil.copy2(src_path, dest_path)
                ColorPrint.blue(f"[LoginTryScreenshotController] Copied {src_path} -> {dest_path}")
                return
        ColorPrint.yellow(
            f"[LoginTryScreenshotController] Template {dest_path.name} not found; "
            f"put {BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME} in {LOGIN_TRY_SCREENSHOT_DIR} or {TEMPLATE_DIR} or {dest_path}"
        )

    def _get_ocr_engine(self) -> Optional[CnOCREngine]:
        if self._ocr_engine is None:
            self._ocr_engine = CnOCREngine()
            if not self._ocr_engine.init():
                self._ocr_engine = None
        return self._ocr_engine

    def _get_battlenet_path(self) -> Optional[Path]:
        path = CONFIG.get("battlenet", {}).get("battlenet_path", "").strip()
        if not path:
            return None
        p = Path(path)
        return p if p.is_file() else None

    def _capture_battlenet_window(self) -> Optional[Path]:
        """Capture Battle.net window; return path to saved image for OCR, or None."""
        screenshot_data = self.screenshot_provider.gen(
            use_optimized_capture=True,
            window_titles=BATTLE_NET_WINDOW_TITLES,
        )
        if screenshot_data is None:
            ColorPrint.yellow("[LoginTryScreenshotController] Battle.net window not found")
            return None
        img = screenshot_data.game_window_image
        if img is None:
            return None
        out_dir = LOGIN_TRY_SCREENSHOT_DIR
        out_dir.mkdir(parents=True, exist_ok=True)
        ts = screenshot_data.timestamp
        path = out_dir / f"{LOGIN_TRY_SCREENSHOT_PREFIX}_battlenet_{ts}.png"
        img.save(path)
        ColorPrint.blue(f"[LoginTryScreenshotController] Battle.net screenshot: {path}")
        return path

    def _ocr_has_disconnect_keywords(self, image_path: Path) -> bool:
        """Run OCR on image; return True if any disconnect keyword (Retry/重试) is in text."""
        engine = self._get_ocr_engine()
        if engine is None:
            ColorPrint.yellow("[LoginTryScreenshotController] OCR not available, skip disconnect check")
            return False
        try:
            result = engine.ocr(str(image_path))
            text = (result or {}).get("text", "") or ""
            for kw in BATTLE_NET_DISCONNECT_KEYWORDS:
                if kw in text:
                    ColorPrint.blue(f"[LoginTryScreenshotController] Disconnect keyword in UI: '{kw}'")
                    return True
            return False
        except Exception as e:
            ColorPrint.red(f"[LoginTryScreenshotController] OCR error: {e}")
            return False

    def _ocr_has_need_login_keywords(self, image_path: Path) -> bool:
        """Run OCR on image; return True if any need-login keyword (需要登陆/请登录/登录) is in text."""
        engine = self._get_ocr_engine()
        if engine is None:
            ColorPrint.yellow("[LoginTryScreenshotController] OCR not available, skip need-login check")
            return False
        try:
            result = engine.ocr(str(image_path))
            text = (result or {}).get("text", "") or ""
            for kw in BATTLE_NET_NEED_LOGIN_KEYWORDS:
                if kw in text:
                    ColorPrint.blue(f"[LoginTryScreenshotController] Need-login keyword in UI: '{kw}'")
                    return True
            return False
        except Exception as e:
            ColorPrint.red(f"[LoginTryScreenshotController] OCR error: {e}")
            return False

    def _pil_to_bgr(self, pil_image) -> Optional[Any]:
        """Convert PIL Image to BGR numpy for ImageMatcher."""
        if pil_image is None:
            return None
        rgb = np.array(pil_image)
        if len(rgb.shape) != 3 or rgb.shape[2] < 3:
            return None
        if rgb.shape[2] == 3:
            return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        return cv2.cvtColor(rgb[:, :, :3], cv2.COLOR_RGB2BGR)

    def _match_battlenet_template(
        self,
        game_window_image,
        template_name: str,
        window_width: int,
        window_height: int,
    ) -> Optional[Dict]:
        """
        Match a Battle.net template on the game window image with proportional scaling.
        Rule (same as D3/D4): predefined standard window size; if actual window differs,
        scale template by (actual/standard) so stretched window still matches.
        Uses ImageMatcher; template is scaled before matching.
        Returns match dict with center, polygon, success or None.
        """
        config = BATTLENET_TEMPLATE_CONFIGS.get(template_name)
        if not config:
            ColorPrint.yellow(f"[LoginTryScreenshotController] Template config not found: {template_name}")
            return None
        path = config.get("path")
        if not path or not Path(path).exists():
            ColorPrint.yellow(f"[LoginTryScreenshotController] Template file not found: {path}")
            return None
        target_bgr = self._pil_to_bgr(game_window_image)
        if target_bgr is None:
            return None
        template_bgr = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if template_bgr is None:
            ColorPrint.yellow(f"[LoginTryScreenshotController] Failed to load template: {path}")
            return None

        # Proportional scaling: scale_x = actual / standard (same rule as game window)
        scale_x = window_width / BATTLENET_STANDARD_RESOLUTION_WIDTH
        scale_y = window_height / BATTLENET_STANDARD_RESOLUTION_HEIGHT
        if abs(scale_x - 1.0) > 0.001 or abs(scale_y - 1.0) > 0.001:
            th, tw = template_bgr.shape[:2]
            new_w = max(1, int(tw * scale_x))
            new_h = max(1, int(th * scale_y))
            interp = cv2.INTER_AREA if (scale_x < 1.0 or scale_y < 1.0) else cv2.INTER_CUBIC
            template_bgr = cv2.resize(template_bgr, (new_w, new_h), interpolation=interp)
            ColorPrint.gray(
                f"[LoginTryScreenshotController] Scaled template {template_name}: "
                f"{BATTLENET_STANDARD_RESOLUTION_WIDTH}x{BATTLENET_STANDARD_RESOLUTION_HEIGHT} -> "
                f"{window_width}x{window_height}, scale=({scale_x:.3f}, {scale_y:.3f})"
            )

        threshold = config.get("threshold", 0.75)
        match_method = config.get("match_method", "TM_CCOEFF_NORMED")
        use_alpha = config.get("use_alpha", False)
        matcher = ImageMatcher(standard_width=window_width, standard_height=window_height)
        result = matcher.match_single_template(
            target_image=target_bgr,
            template_image=template_bgr,
            template_name=template_name,
            custom_threshold=threshold,
            use_alpha=use_alpha,
            detection_method=match_method,
        )
        return result if (result and result.get("success")) else None

    def _save_match_debug_image(self, pil_image, match: Dict, label: str, output_dir: Path) -> Optional[Path]:
        """Draw match polygon and center on image, save to output_dir for debugging."""
        if pil_image is None or not match:
            return None
        from pycore.pyfoundations.third_party import get_third_package_PIL_ImageDraw
        ImageDraw = get_third_package_PIL_ImageDraw()
        img = pil_image.copy()
        draw = ImageDraw.Draw(img)
        polygon = match.get("polygon")
        center = match.get("center")
        if polygon is not None and hasattr(polygon, "__iter__"):
            pts = [(int(p[0]), int(p[1])) for p in polygon]
            if len(pts) >= 2:
                draw.polygon(pts, outline="red")
        if center is not None:
            cx, cy = int(center[0]), int(center[1])
            r = 8
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline="blue")
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        path = output_dir / f"login_try_match_debug_{label}_{ts}.png"
        output_dir.mkdir(parents=True, exist_ok=True)
        img.save(path)
        ColorPrint.blue(f"[LoginTryScreenshotController] Debug image saved: {path}")
        return path

    def _kill_battlenet(self) -> bool:
        """Kill Battle.net.exe using taskkill (no threading)."""
        try:
            ColorPrint.blue("[LoginTryScreenshotController] Killing Battle.net...")
            r = subprocess.run(
                ["taskkill", "/F", "/IM", BATTLE_NET_EXE_NAME],
                capture_output=True,
                text=True,
                timeout=15,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            if r.returncode == 0:
                ColorPrint.green("[LoginTryScreenshotController] Battle.net killed")
                return True
            if "not found" in (r.stderr or "").lower() or "not found" in (r.stdout or "").lower():
                ColorPrint.yellow("[LoginTryScreenshotController] Battle.net was not running")
                return True
            ColorPrint.yellow(f"[LoginTryScreenshotController] taskkill: {r.stderr or r.stdout}")
            return False
        except Exception as e:
            ColorPrint.red(f"[LoginTryScreenshotController] Kill error: {e}")
            return False

    def _start_battlenet(self, exe_path: Path) -> bool:
        """Start Battle.net via explorer (no threading)."""
        try:
            ColorPrint.blue(f"[LoginTryScreenshotController] Starting Battle.net: {exe_path}")
            subprocess.run(
                ["explorer", str(exe_path)],
                cwd=str(exe_path.parent),
                capture_output=True,
                text=True,
                timeout=30,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            ColorPrint.green("[LoginTryScreenshotController] Battle.net start command sent")
            return True
        except Exception as e:
            ColorPrint.red(f"[LoginTryScreenshotController] Start error: {e}")
            return False

    def handle_login_try(self) -> None:
        """
        On "Login try" in log: capture Battle.net window, OCR for Retry/重试;
        if found, treat as disconnect and restart Battle.net.exe (taskkill + explorer).
        Uses config battlenet.battlenet_path and BATTLE_NET_WINDOW_TITLES; no Python threading.
        """
        bn_path = self._get_battlenet_path()
        if not bn_path:
            ColorPrint.yellow("[LoginTryScreenshotController] No battlenet.battlenet_path in config")
            self.capture_screenshot()
            return

        img_path = self._capture_battlenet_window()
        if img_path is None:
            self.capture_screenshot()
            return

        if not self._ocr_has_disconnect_keywords(img_path):
            ColorPrint.blue("[LoginTryScreenshotController] No disconnect keywords, skip restart")
            return

        ColorPrint.blue("[LoginTryScreenshotController] Disconnect detected, restarting Battle.net...")
        self._kill_battlenet()
        time.sleep(2)
        self._start_battlenet(bn_path)

    def handle_screenshot_trigger(self) -> None:
        """
        Screenshot trigger: capture Battle.net window, OCR for need-login keywords (需要登陆/请登录/登录);
        if found, trigger re-login (taskkill + explorer start). No restart if not found.
        """
        bn_path = self._get_battlenet_path()
        if not bn_path:
            ColorPrint.yellow("[LoginTryScreenshotController] No battlenet.battlenet_path in config, skip screenshot trigger")
            return
        img_path = self._capture_battlenet_window()
        if img_path is None:
            ColorPrint.yellow("[LoginTryScreenshotController] Battle.net window not found, skip screenshot trigger")
            return
        if not self._ocr_has_need_login_keywords(img_path):
            ColorPrint.blue("[LoginTryScreenshotController] No need-login keywords, skip re-login")
            return
        ColorPrint.blue("[LoginTryScreenshotController] Need-login detected, triggering re-login (kill + start)...")
        self._kill_battlenet()
        time.sleep(2)
        self._start_battlenet(bn_path)

    def ensure_battlenet_started_and_login_check(self) -> bool:
        """
        Step 1 for starting ROSBOT: ensure Battle.net is started, activate UI (tray click, no restart),
        screenshot and check need-login text; also require D3 small map template found for UI 登陆成功.
        If login success: save match debug image, click D3 small map, then click Play/开始游戏.
        Returns True if step completed (with or without re-login), False if config missing or window unavailable.
        """
        bn_path = self._get_battlenet_path()
        if not bn_path:
            ColorPrint.yellow("[LoginTryScreenshotController] No battlenet.battlenet_path in config, skip step 1")
            return False

        # If Battle.net window not found, start it first
        img_path = self._capture_battlenet_window()
        if img_path is None:
            ColorPrint.blue("[LoginTryScreenshotController] Battle.net window not found, starting Battle.net...")
            self._start_battlenet(bn_path)
            time.sleep(3)

        # Activate UI by clicking tray icon (no restart)
        ColorPrint.blue("[LoginTryScreenshotController] Activating Battle.net UI (tray click)...")
        clicker = ClickHandler()
        clicker.find_and_click_tray_icon()
        time.sleep(1.5)

        screenshot_data = self.screenshot_provider.gen(
            use_optimized_capture=True,
            window_titles=BATTLE_NET_WINDOW_TITLES,
        )
        if screenshot_data is None:
            ColorPrint.yellow("[LoginTryScreenshotController] Battle.net window still not found after activate, skip step 1")
            return False

        img = screenshot_data.game_window_image
        if img is None:
            ColorPrint.yellow("[LoginTryScreenshotController] No game window image, skip step 1")
            return False

        LOGIN_TRY_SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        ts = screenshot_data.timestamp
        img_path = LOGIN_TRY_SCREENSHOT_DIR / f"{LOGIN_TRY_SCREENSHOT_PREFIX}_battlenet_{ts}.png"
        img.save(img_path)
        ColorPrint.blue(f"[LoginTryScreenshotController] Battle.net screenshot: {img_path}")

        if self._ocr_has_need_login_keywords(img_path):
            ColorPrint.blue("[LoginTryScreenshotController] Need-login text detected, triggering re-login...")
            self._kill_battlenet()
            time.sleep(2)
            self._start_battlenet(bn_path)
            return True

        w, h = screenshot_data.game_window_size or (img.width, img.height)
        d3_small_map_match = self._match_battlenet_template(
            img, BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME, w, h
        )
        if d3_small_map_match is None:
            ColorPrint.yellow("[LoginTryScreenshotController] D3 small map not found, skip UI login success")
            return True

        ColorPrint.green("[LoginTryScreenshotController] UI 登陆成功 (D3 small map found)")
        self._save_match_debug_image(img, d3_small_map_match, "d3_small_map", LOGIN_TRY_SCREENSHOT_DIR)

        ox, oy = screenshot_data.window_offset
        cx = int(d3_small_map_match["center"][0])
        cy = int(d3_small_map_match["center"][1])
        click_x = ox + cx
        click_y = oy + cy
        ColorPrint.blue(f"[LoginTryScreenshotController] Clicking D3 small map at screen ({click_x}, {click_y})")
        clicker.click(click_x, click_y)
        time.sleep(0.8)

        screenshot_data2 = self.screenshot_provider.gen(
            use_optimized_capture=True,
            window_titles=BATTLE_NET_WINDOW_TITLES,
        )
        if screenshot_data2 and screenshot_data2.game_window_image:
            img2 = screenshot_data2.game_window_image
            w2, h2 = screenshot_data2.game_window_size or (img2.width, img2.height)
            play_match = None
            for play_template_name in BATTLE_NET_PLAY_BUTTON_TEMPLATE_NAMES:
                play_match = self._match_battlenet_template(img2, play_template_name, w2, h2)
                if play_match:
                    ColorPrint.blue(f"[LoginTryScreenshotController] Found Play/开始游戏: {play_template_name}")
                    break
            if play_match:
                self._save_match_debug_image(img2, play_match, "play_button", LOGIN_TRY_SCREENSHOT_DIR)
                ox2, oy2 = screenshot_data2.window_offset
                px = int(play_match["center"][0])
                py = int(play_match["center"][1])
                play_x = ox2 + px
                play_y = oy2 + py
                ColorPrint.blue(f"[LoginTryScreenshotController] Clicking Play/开始游戏 at screen ({play_x}, {play_y})")
                clicker.click(play_x, play_y)
            else:
                ColorPrint.yellow("[LoginTryScreenshotController] Play/开始游戏 template not found (tried zh & en), skip click")

        return True

    def capture_screenshot(self) -> Optional[Dict[str, Path]]:
        """
        Capture full-screen screenshot and save to login_try_screenshots dir.

        Returns:
            Dict with fullscreen_path and optionally game_window_path, or None on failure.
        """
        try:
            ColorPrint.blue("[LoginTryScreenshotController] Capturing full-screen screenshot...")

            screenshot_data = self.screenshot_provider.gen(
                use_optimized_capture=False,
                window_titles=None,
            )

            if screenshot_data is None:
                ColorPrint.yellow("[LoginTryScreenshotController] Failed to capture screenshot")
                return None

            saved = screenshot_data.save(
                output_dir=LOGIN_TRY_SCREENSHOT_DIR,
                prefix=LOGIN_TRY_SCREENSHOT_PREFIX,
            )

            if saved:
                ColorPrint.green(
                    f"[LoginTryScreenshotController] Screenshot saved: {saved.get('fullscreen_path')}"
                )
            return saved

        except Exception as e:
            ColorPrint.red(f"[LoginTryScreenshotController] Error: {e}")
            return None


_login_try_controller: Optional[LoginTryScreenshotController] = None


def get_login_try_screenshot_controller() -> LoginTryScreenshotController:
    """Get global LoginTryScreenshotController instance (singleton)."""
    global _login_try_controller
    if _login_try_controller is None:
        _login_try_controller = LoginTryScreenshotController()
    return _login_try_controller
