# -*- coding: utf-8 -*-
"""
Fetch Maxroll D3Planner: Export CSV (via d3p-export) and download equipment images from d3planner-wrapper.
- Export: click element with class d3p-export to trigger CSV download.
- Images: only from .d3planner-wrapper — equipment icons from d3planner-assets.maxroll.gg/icons/*.png.
- Output includes equipment_image_urls (list of icon URLs). Skill background images optional.
Uses pycore third_party and browser_finder.
"""
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from pycore.pyfoundations.third_party import (
    get_third_package_selenium,
    get_third_package_webdriver_manager,
    get_third_package_requests,
)
from pycore.pyutils.pybrowser.utils.browser_finder import find_browser, find_driver

BASE_OUT_DIR = _REPO_ROOT / "pyapps" / "d3-check" / "images" / "maxroll_d3planner"
PLANNER_WAIT_TIMEOUT = 30
EXPORT_CLICK_WAIT = 5
DOWNLOAD_WAIT = 12
ASSETS_DOMAIN = "assets-ng.maxroll.gg"
DEFAULT_URL = "https://maxroll.gg/d3/d3planner/636780088"


def build_id_from_url(url: str) -> str:
    path = urlparse(url).path.rstrip("/")
    parts = path.split("/")
    return parts[-1] if parts else "unknown"


def _wait_for_planner(driver, By, timeout=PLANNER_WAIT_TIMEOUT):
    """Wait for planner UI: d3p-export / d3planner-wrapper first, then data-rbd, export, or iframe."""
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    wait = WebDriverWait(driver, timeout)
    selectors = [
        "[class*='d3p-export']",
        "[class*='d3planner-wrapper']",
        "img[src*='d3planner-assets.maxroll.gg/icons']",
        "[data-rbd-droppable-context-id]",
        "[data-rbd-drag-handle-context-id]",
        "a[download]",
        "[aria-label*='csv' i]",
        "[aria-label*='export' i]",
        "[data-testid*='export' i]",
        "[data-testid*='csv' i]",
        "iframe[src*='d3planner']",
        "iframe[src*='assets-ng.maxroll']",
    ]
    for sel in selectors:
        try:
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, sel)))
            return True
        except Exception:
            continue
    return False


def _is_in_sidebar(el, driver) -> bool:
    """True if element is inside the fixed left sidebar (narrow nav column)."""
    try:
        script = """
        var n = arguments[0];
        while (n) {
            var c = (n.className || '').toString();
            if ((c.indexOf('w-24') >= 0 || c.indexOf('w-20') >= 0) && (c.indexOf('left-0') >= 0 || c.indexOf('inset-y-0') >= 0) && c.indexOf('fixed') >= 0)
                return true;
            n = n.parentElement;
        }
        return false;
        """
        return driver.execute_script(script, el) is True
    except Exception:
        return False


def _find_export_csv_button(driver, By):
    """Find Export: prefer d3p-export (class), then Export CSV text / aria / download."""
    # 0) d3p-export — the export control; often opens dropdown, then pick CSV
    for sel in ["[class*='d3p-export']", ".d3p-export", "#d3p-export"]:
        for el in driver.find_elements(By.CSS_SELECTOR, sel):
            try:
                if el.is_displayed():
                    return ("export_then_csv", el)
            except Exception:
                pass
    # 1) Full phrase in element (including children): 导出CSV文件 / Export CSV
    for xpath in [
        "//a[contains(., '导出CSV文件')]",
        "//a[contains(., '导出CSV')]",
        "//button[contains(., '导出CSV')]",
        "//*[@role='button'][contains(., '导出CSV')]",
        "//a[contains(., 'Export CSV')]",
        "//button[contains(., 'Export CSV')]",
    ]:
        for el in driver.find_elements(By.XPATH, xpath):
            try:
                if el.is_displayed() and not _is_in_sidebar(el, driver):
                    return ("click", el)
            except Exception:
                pass
    # 1) Direct: text contains "Export CSV" / "导出CSV" (any language)
    for xpath in [
        "//a[contains(., '导出') and contains(., 'CSV')]",
        "//button[contains(., '导出') and contains(., 'CSV')]",
        "//*[@role='button'][contains(., '导出') and contains(., 'CSV')]",
        "//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'export') and contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'csv')]",
        "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'export') and contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'csv')]",
    ]:
        for el in driver.find_elements(By.XPATH, xpath):
            try:
                if el.is_displayed() and not _is_in_sidebar(el, driver):
                    return ("click", el)
            except Exception:
                pass
    for el in driver.find_elements(By.CSS_SELECTOR, "a[download], a[href*='csv'], a[href*='export']"):
        try:
            download = (el.get_attribute("download") or "").lower()
            href = (el.get_attribute("href") or "").lower()
            if (download and "csv" in download) or "csv" in href:
                if el.is_displayed() and not _is_in_sidebar(el, driver):
                    return ("click", el)
        except Exception:
            pass
    # 2) Export dropdown: find button/link with "Export" or "导出" in planner (not sidebar)
    for sel in ("button", "a", "[role='button']"):
        for el in driver.find_elements(By.CSS_SELECTOR, sel):
            try:
                text = (el.text or "").strip()
                aria = (el.get_attribute("aria-label") or "").strip()
                if not re.search(r"export|导出", text + " " + aria, re.I):
                    continue
                if "csv" in (text + aria).lower():
                    if el.is_displayed() and not _is_in_sidebar(el, driver):
                        return ("click", el)
                    continue
                if el.is_displayed() and not _is_in_sidebar(el, driver):
                    return ("export_then_csv", el)
            except Exception:
                pass
    return None


def _switch_to_planner_iframe(driver, By):
    """If planner is in iframe, switch to it. Return True if switched."""
    for frame in driver.find_elements(By.CSS_SELECTOR, "iframe[src*='d3planner'], iframe[src*='assets-ng.maxroll']"):
        try:
            driver.switch_to.frame(frame)
            return True
        except Exception:
            pass
    return False


def _get_wrapper_root(driver, By):
    """Return first visible element that has d3planner-wrapper (scope for equipment/skill)."""
    for sel in ["[class*='d3planner-wrapper']", ".d3planner-wrapper"]:
        for el in driver.find_elements(By.CSS_SELECTOR, sel):
            try:
                if el.is_displayed():
                    return el
            except Exception:
                pass
    return None


def _collect_equipment_images_from_wrapper(driver, By) -> tuple:
    """
    Collect equipment icon (src, name) only from inside d3planner-wrapper.
    Equipment icons: img[src*='d3planner-assets.maxroll.gg/icons'].
    Returns (list of (src, name)), list of src URLs for output.
    """
    out = []
    urls = []
    wrapper = _get_wrapper_root(driver, By)
    if not wrapper:
        for img in driver.find_elements(By.CSS_SELECTOR, "img[src*='d3planner-assets.maxroll.gg/icons']"):
            try:
                src = img.get_attribute("src") or img.get_attribute("data-src")
                if not src or src in urls:
                    continue
                urls.append(src)
                name = img.get_attribute("alt") or img.get_attribute("aria-label") or img.get_attribute("title")
                if not name:
                    name = urlparse(src).path.split("/")[-1].split("?")[0] or "icon"
                out.append((src, name))
            except Exception:
                pass
        return out, urls
    try:
        for img in wrapper.find_elements(By.CSS_SELECTOR, "img[src*='d3planner-assets.maxroll.gg/icons']"):
            try:
                src = img.get_attribute("src") or img.get_attribute("data-src")
                if not src or src in urls:
                    continue
                urls.append(src)
                name = img.get_attribute("alt") or img.get_attribute("aria-label") or img.get_attribute("title")
                if not name:
                    name = urlparse(src).path.split("/")[-1].split("?")[0] or "icon"
                out.append((src, name))
            except Exception:
                pass
    except Exception:
        pass
    return out, urls


def _safe_filename(s: str) -> str:
    for c in ('\\', '/', ':', '*', '?', '"', '<', '>', '|'):
        s = s.replace(c, "_")
    return (s or "unnamed").strip()[:120]


def run(url: str, out_dir: Path, driver, By) -> dict:
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    out_dir.mkdir(parents=True, exist_ok=True)
    driver.get(url)
    try:
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    except Exception:
        pass
    time.sleep(10)
    in_iframe = _switch_to_planner_iframe(driver, By)
    planner_ready = _wait_for_planner(driver, By, timeout=PLANNER_WAIT_TIMEOUT)
    if not planner_ready and not in_iframe:
        time.sleep(8)
    time.sleep(4)
    build_title = ""
    try:
        build_title = (driver.title or "").strip()
    except Exception:
        pass

    csv_path = None
    export_result = _find_export_csv_button(driver, By)
    if export_result:
        action, export_el = export_result
        try:
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", export_el)
            time.sleep(0.5)
            try:
                driver.execute_script("arguments[0].click();", export_el)
            except Exception:
                export_el.click()
            if action == "export_then_csv":
                time.sleep(1.5)
                csv_clicked = False
                # Prefer direct CSV link (download or href)
                for el in driver.find_elements(By.CSS_SELECTOR, "a[download*='csv' i], a[download*='CSV'], a[href*='.csv' i], [role='menuitem'] a, [role='option'] a"):
                    try:
                        if el.is_displayed():
                            t = (el.text or el.get_attribute("aria-label") or "").strip()
                            if "csv" in t.lower() or "导出" in t or el.get_attribute("download") or (el.get_attribute("href") or "").endswith(".csv"):
                                driver.execute_script("arguments[0].click();", el)
                                csv_clicked = True
                                break
                    except Exception:
                        pass
                if not csv_clicked:
                    for menu_sel in [
                        "//*[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'csv')]",
                        "//*[contains(., '导出')]",
                        "[role='menuitem']",
                        "[role='option']",
                    ]:
                        try:
                            if menu_sel.startswith("//"):
                                items = driver.find_elements(By.XPATH, menu_sel)
                            else:
                                items = driver.find_elements(By.CSS_SELECTOR, menu_sel)
                            for item in items:
                                try:
                                    t = (item.text or "").strip()
                                    if not t or ("csv" not in t.lower() and "导出" not in t):
                                        continue
                                    if item.is_displayed():
                                        driver.execute_script("arguments[0].click();", item)
                                        csv_clicked = True
                                        break
                                except Exception:
                                    pass
                            if csv_clicked:
                                break
                        except Exception:
                            pass
                if not csv_clicked:
                    try:
                        from selenium.webdriver.common.keys import Keys
                        from selenium.webdriver.common.action_chains import ActionChains
                        ActionChains(driver).send_keys(Keys.ARROW_DOWN).send_keys(Keys.ENTER).perform()
                        csv_clicked = True
                    except Exception:
                        pass
            time.sleep(EXPORT_CLICK_WAIT)
            download_dir = out_dir
            for f in download_dir.glob("*.csv"):
                csv_path = f
                break
            if not csv_path and Path.home().joinpath("Downloads").exists():
                for _ in range(int(DOWNLOAD_WAIT)):
                    time.sleep(1)
                    for f in Path.home().joinpath("Downloads").glob("*.csv"):
                        if f.stat().st_mtime >= time.time() - 60:
                            csv_path = out_dir / f.name
                            try:
                                import shutil
                                shutil.move(str(f), str(csv_path))
                            except Exception:
                                csv_path = f
                            break
                    if csv_path:
                        break
        except Exception:
            pass

    images, equipment_image_urls = _collect_equipment_images_from_wrapper(driver, By)
    if not images and in_iframe:
        try:
            driver.switch_to.default_content()
            images, equipment_image_urls = _collect_equipment_images_from_wrapper(driver, By)
        except Exception:
            equipment_image_urls = equipment_image_urls or []
    try:
        import requests as _requests_mod
    except ImportError:
        _requests_mod = get_third_package_requests()
    requests_pkg = _requests_mod
    if requests_pkg:
        session = requests_pkg.Session()
        session.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        icons_dir = out_dir / "icons"
        icons_dir.mkdir(parents=True, exist_ok=True)
        for src, name in images:
            raw = _safe_filename(name)
            if raw.lower().endswith(".png") or raw.lower().endswith(".jpg") or raw.lower().endswith(".jpeg"):
                fname = raw
            else:
                ext = ".png"
                if ".jpg" in src.lower() or "jpeg" in src.lower():
                    ext = ".jpg"
                fname = raw + ext
            path = icons_dir / fname
            if path.exists():
                continue
            try:
                r = session.get(src, timeout=20, stream=True)
                r.raise_for_status()
                path.write_bytes(r.content)
            except Exception:
                pass
            time.sleep(0.08)

    equipment_image_urls = list(equipment_image_urls) if equipment_image_urls else []
    result = {
        "url": url,
        "build_id": build_id_from_url(url),
        "build_title": build_title,
        "csv_saved": str(csv_path) if csv_path else None,
        "images_count": len(images),
        "equipment_image_urls": equipment_image_urls,
    }
    (out_dir / "build.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Result: csv_saved={result['csv_saved']}, equipment_images={len(equipment_image_urls)}")
    lines = [
        f"Build: {result['build_id']}",
        f"Title: {build_title}",
        f"URL: {url}",
        f"CSV: {result['csv_saved']}",
        f"Images: {result['images_count']}",
        "Equipment image URLs:",
    ]
    for u in equipment_image_urls:
        lines.append(u)
    (out_dir / "summary.txt").write_text("\n".join(lines), encoding="utf-8")
    try:
        driver.switch_to.default_content()
    except Exception:
        pass
    try:
        src = driver.page_source
        if len(src) > 300000:
            src = src[:300000] + "\n... [truncated]"
        (out_dir / "page_fragment.html").write_text(src, encoding="utf-8", errors="replace")
    except Exception:
        pass
    return result


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fetch Maxroll D3Planner: Export CSV + download images.")
    parser.add_argument("url", nargs="?", default=DEFAULT_URL, help="D3Planner build URL")
    parser.add_argument("-o", "--out-dir", type=Path, default=BASE_OUT_DIR, help="Base output directory")
    parser.add_argument("--headless", action="store_true")
    args = parser.parse_args()

    selenium = get_third_package_selenium()
    wdm = get_third_package_webdriver_manager()
    if selenium is None or wdm is None:
        print("Selenium or webdriver-manager not available.")
        return 1

    from selenium.webdriver.common.by import By
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options

    out_base = args.out_dir.resolve()
    build_id = build_id_from_url(args.url)
    out_dir = out_base / build_id
    out_dir.mkdir(parents=True, exist_ok=True)

    options = Options()
    if args.headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    prefs = {
        "download.default_directory": str(out_dir.resolve()),
        "download.prompt_for_download": False,
        "safebrowsing.enabled": True,
    }
    options.add_experimental_option("prefs", prefs)

    driver = None
    chrome_bin = find_browser("chrome")
    driver_path = find_driver("chrome")
    if chrome_bin:
        options.binary_location = chrome_bin
    if driver_path and chrome_bin:
        try:
            driver = selenium.webdriver.Chrome(service=Service(driver_path), options=options)
        except Exception:
            pass
    if driver is None:
        try:
            ChromeDriverManager = getattr(wdm.chrome, "ChromeDriverManager", None) or __import__("webdriver_manager.chrome", fromlist=["ChromeDriverManager"]).ChromeDriverManager
            driver = selenium.webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        except Exception:
            try:
                from selenium.webdriver.edge.service import Service as EdgeService
                from selenium.webdriver.edge.options import Options as EdgeOptions
                EdgeDriverManager = getattr(wdm.microsoft, "EdgeChromiumDriverManager", None)
                if EdgeDriverManager is None:
                    from webdriver_manager.microsoft import EdgeChromiumDriverManager as EdgeDriverManager
                driver = selenium.webdriver.Edge(service=EdgeService(EdgeDriverManager().install()), options=EdgeOptions())
            except Exception:
                pass
    if driver is None:
        print("Could not start browser.")
        return 1

    driver.implicitly_wait(5)
    try:
        result = run(args.url, out_dir, driver, By)
        print(f"CSV: {result.get('csv_saved', 'none')}, Images: {result.get('images_count', 0)}")
        print(f"Output: {out_dir}")
    finally:
        driver.quit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
