# -*- coding: utf-8 -*-
"""
Fetch all images from Fandom category page gallery (.mw-gallery-traditional).
Uses Selenium to open the page, scroll to trigger lazy load, then collect image URLs and download.
Uses pycore third_party for selenium and webdriver_manager.
When no browser/driver available, falls back to static Fandom URLs (diablo_gamepedia) for the 127 gem icons.
"""
import hashlib
import re
import shutil
import sys
import time
from pathlib import Path
from urllib.parse import quote

# Allow importing pycore when run from scripts/selenium_test or repo root
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from pycore.pyfoundations.third_party.api import get_third_package_selenium, get_third_package_webdriver_manager, get_third_package_requests
from pycore.pyutils.pybrowser.utils.browser_finder import find_browser, find_driver

DEFAULT_URL = "https://diablo-archive.fandom.com/wiki/Category:Diablo_III_gem_icons"
DEFAULT_OUT_DIR = Path(__file__).resolve().parent / "out_gallery_images"
SCROLL_PAUSE = 0.4
PAGE_LOAD_WAIT = 15
EXPECTED_IMAGES = 127
MAX_RETRIES = 5


def safe_filename(name: str) -> str:
    for c in ("/", "\\", ":", "*", "?", '"', "<", ">", "|"):
        name = name.replace(c, "_")
    return name or "unnamed"


def extract_filename_from_url(url: str) -> str:
    """Get filename from URL, strip query and revision path."""
    if not url:
        return "unnamed.png"
    path = url.split("?")[0].rstrip("/")
    if "/revision/" in path:
        path = path.split("/revision/")[0]
    name = path.split("/")[-1] if "/" in path else path
    return name or "unnamed.png"


# Fallback when Selenium cannot start: 127 gem icon filenames from category "Media in category"
GEM_ICON_FILENAMES = [
    "Amethyst.png", "Bane of the Powerful.png", "Bane of the Stricken.png", "Bane of the Trapped.png",
    "Boon of the Hoarder.png", "Boyarsky's Chip.png", "Chipped Amethyst.png", "Chipped Diamond.png",
    "Chipped Emerald.png", "Chipped Ruby.png", "Chipped Topaz.png", "D3 Gem Chart.png", "Diamond.png",
    "Emerald.png", "Enforcer.png", "Esoteric Alteration.png", "Flawed Amethyst.png", "Flawed Diamond.png",
    "Flawed Emerald.png", "Flawed Ruby.png", "Flawed Topaz.png", "Flawless Amethyst.png", "Flawless Diamond.png",
    "Flawless Emerald.png", "Flawless Imperial Amethyst.png", "Flawless Imperial Diamond.png",
    "Flawless Imperial Emerald.png", "Flawless Imperial Ruby.png", "Flawless Imperial Topaz.png",
    "Flawless Round Diamond.png", "Flawless Round Sapphire.png", "Flawless Royal Amethyst.png",
    "Flawless Royal Diamond.png", "Flawless Royal Emerald.png", "Flawless Royal Ruby.png", "Flawless Royal Topaz.png",
    "Flawless Ruby.png", "Flawless Square Amethyst.png", "Flawless Square Diamond.png", "Flawless Square Emerald.png",
    "Flawless Square Ruby.png", "Flawless Square Sapphire.png", "Flawless Square Topaz.png", "Flawless Star Amethyst.png",
    "Flawless Star Diamond.png", "Flawless Star Emerald.png", "Flawless Star Ruby.png", "Flawless Star Sapphire.png",
    "Flawless Star Topaz.png", "Flawless Topaz.png", "Gem of Ease.png", "Gem of Efficacious Toxin.png",
    "Gogok of Swiftness.png", "Iceblink.png", "Imperial Amethyst.png", "Imperial Diamond.png", "Imperial Emerald.png",
    "Imperial Ruby.png", "Imperial Topaz.png", "Invigorating Gemstone.png", "Marquise Amethyst.png", "Marquise Diamond.png",
    "Marquise Emerald.png", "Marquise Ruby.png", "Marquise Topaz.png", "Mirinae, Teardrop of the Starweaver.png",
    "Molten Wildebeest's Gizzard.png", "Moratorium.png", "Mutilation Guard.png", "Pain Enhancer.png",
    "Perfect Amethyst.png", "Perfect Emerald.png", "Perfect Ruby.png", "Perfect Square Amethyst.png", "Perfect Square Emerald.png",
    "Perfect Square Ruby.png", "Perfect Square Topaz.png", "Perfect Star Amethyst.png", "Perfect Star Emerald.png",
    "Perfect Star Ruby.png", "Perfect Star Topaz.png", "Perfect Topaz.png", "Radiant Amethyst.png", "Radiant Diamond.png",
    "Radiant Emerald.png", "Radiant Round Diamond.png", "Radiant Round Sapphire.png", "Radiant Ruby.png", "Radiant Sapphire.png",
    "Radiant Square Amethyst.png", "Radiant Square Diamond.png", "Radiant Square Emerald.png", "Radiant Square Ruby.png",
    "Radiant Square Sapphire.png", "Radiant Square Topaz.png", "Radiant Star Amethyst.png", "Radiant Star Diamond.png",
    "Radiant Star Emerald.png", "Radiant Star Ruby.png", "Radiant Star Sapphire.png", "Radiant Star Topaz.png",
    "Radiant Topaz.png", "Round Diamond.png", "Round Sapphire.png", "Royal Amethyst.png", "Royal Diamond.png",
    "Royal Emerald.png", "Royal Ruby.png", "Royal Topaz.png", "Ruby.png", "Simplicity's Strength.png",
    "Square Amethyst.png", "Square Diamond.png", "Square Emerald.png", "Square Ruby.png", "Square Sapphire.png", "Square Topaz.png",
    "Star Amethyst.png", "Star Diamond.png", "Star Emerald.png", "Star Ruby.png", "Star Sapphire.png", "Star Topaz.png",
    "Taeguk.png", "Topaz.png", "Wreath of Lightning.png", "Zei's Stone of Vengeance.png",
]


def _static_url_for_fandom_file(wiki_dbname: str, filename: str) -> str:
    """Fandom static image URL: static.wikia.nocookie.net/{dbname}/images/{a}/{ab}/{filename}"""
    raw = filename.replace(" ", "_")
    h = hashlib.md5(raw.encode("utf-8")).hexdigest()
    a, ab = h[0], h[:2]
    return f"https://static.wikia.nocookie.net/{wiki_dbname}/images/{a}/{ab}/{quote(raw)}"


def fallback_download_static_urls(out_dir: Path, session, expected: int = EXPECTED_IMAGES) -> int:
    """When Selenium unavailable, try Fandom static URLs (diablo_gamepedia). Returns count downloaded."""
    out_dir.mkdir(parents=True, exist_ok=True)
    ok = 0
    for fname in GEM_ICON_FILENAMES:
        path = out_dir / safe_filename(fname)
        if path.exists():
            ok += 1
            continue
        url = _static_url_for_fandom_file("diablo_gamepedia", fname)
        try:
            r = session.head(url, timeout=10, allow_redirects=True)
            if r.status_code != 200 or not (r.headers.get("content-type") or "").startswith("image/"):
                continue
            r = session.get(url, timeout=30, stream=True)
            r.raise_for_status()
            with open(path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            ok += 1
            print(f"  ok: {path.name}")
        except Exception:
            pass
        time.sleep(0.12)
    return ok


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fetch Fandom gallery images via Selenium.")
    parser.add_argument("url", nargs="?", default=DEFAULT_URL, help="Category page URL")
    parser.add_argument("-o", "--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="Output directory")
    parser.add_argument("--headless", action="store_true", help="Run browser headless")
    parser.add_argument("--no-headless", dest="headless", action="store_false", help="Show browser window")
    parser.add_argument("--max-retries", type=int, default=MAX_RETRIES, help="Max rounds to retry until all images present")
    parser.set_defaults(headless=False)
    args = parser.parse_args()

    selenium = get_third_package_selenium()
    wdm = get_third_package_webdriver_manager()
    if selenium is None or wdm is None:
        print("Selenium or webdriver-manager not available.")
        return 1

    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options

    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    requests_pkg = get_third_package_requests()
    if requests_pkg is None:
        print("requests not available.")
        return 1
    session = requests_pkg.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

    options = Options()
    if args.headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")

    driver = None
    chrome_bin = find_browser("chrome")
    driver_path = find_driver("chrome")
    if chrome_bin:
        options.binary_location = chrome_bin
    if driver_path and chrome_bin:
        print(f"Using Chrome: {chrome_bin}, driver: {driver_path}")
        try:
            service = Service(driver_path)
            driver = selenium.webdriver.Chrome(service=service, options=options)
        except Exception as e:
            print(f"browser_finder Chrome failed: {e}")
            driver = None
    if driver is None:
        try:
            ChromeDriverManager = wdm.chrome.ChromeDriverManager
        except AttributeError:
            from webdriver_manager.chrome import ChromeDriverManager
        try:
            service = Service(ChromeDriverManager().install())
            driver = selenium.webdriver.Chrome(service=service, options=options)
        except Exception as e:
            err_msg = str(e).lower()
            if "chrome binary" in err_msg or "cannot find chrome" in err_msg or "session not created" in err_msg:
                print("Chrome not found; trying Edge (Chromium)...")
                try:
                    from selenium.webdriver.edge.service import Service as EdgeService
                    from selenium.webdriver.edge.options import Options as EdgeOptions
                    try:
                        EdgeDriverManager = wdm.microsoft.EdgeChromiumDriverManager
                    except AttributeError:
                        from webdriver_manager.microsoft import EdgeChromiumDriverManager as EdgeDriverManager
                    edge_opts = EdgeOptions()
                    if args.headless:
                        edge_opts.add_argument("--headless=new")
                    edge_opts.add_argument("--no-sandbox")
                    edge_opts.add_argument("--disable-dev-shm-usage")
                    edge_opts.add_argument("--window-size=1920,1080")
                    service = EdgeService(EdgeDriverManager().install())
                    driver = selenium.webdriver.Edge(service=service, options=edge_opts)
                except Exception as e2:
                    pass
                if driver is None:
                    driver_path = shutil.which("chromedriver")
                    if driver_path:
                        print(f"Trying Chrome from PATH: {driver_path}")
                        try:
                            service = Service(driver_path)
                            driver = selenium.webdriver.Chrome(service=service, options=options)
                        except Exception:
                            pass
                    if driver is None:
                        ed_path = shutil.which("msedgedriver")
                        if ed_path:
                            print(f"Trying Edge from PATH: {ed_path}")
                            try:
                                from selenium.webdriver.edge.service import Service as EdgeService
                                from selenium.webdriver.edge.options import Options as EdgeOptions
                                edge_opts = EdgeOptions()
                                if args.headless:
                                    edge_opts.add_argument("--headless=new")
                                edge_opts.add_argument("--no-sandbox")
                                service = EdgeService(ed_path)
                                driver = selenium.webdriver.Edge(service=service, options=edge_opts)
                            except Exception:
                                pass
                if driver is None:
                    print("Browser not available. Trying fallback: static Fandom URLs (diablo_gamepedia)...")
                    n = fallback_download_static_urls(out_dir, session)
                    if n >= EXPECTED_IMAGES:
                        print(f"Fallback done. {n} images. Output: {out_dir}")
                        return 0
                    print("Fallback did not get all images. Install Chrome (e.g. D:\\applications\\Chrome) or Edge.")
                    return 1
            else:
                print(f"ChromeDriver failed: {e}")
                return 1
    driver.implicitly_wait(5)
    wait = WebDriverWait(driver, PAGE_LOAD_WAIT)

    for attempt in range(1, args.max_retries + 1):
        current_count = len(list(out_dir.glob("*.*")))
        if current_count >= EXPECTED_IMAGES:
            print(f"Already have {current_count} images. Done.")
            driver.quit()
            return 0
        if attempt > 1:
            print(f"Retry {attempt}/{args.max_retries} (have {current_count}/{EXPECTED_IMAGES})...")

        try:
            print(f"Opening {args.url}")
            driver.get(args.url)
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".mw-gallery-traditional")))
            gallery = driver.find_element(By.CSS_SELECTOR, ".gallery.mw-gallery-traditional")
            boxes = gallery.find_elements(By.CSS_SELECTOR, "li.gallerybox")
            print(f"Found {len(boxes)} gallery items. Scrolling to trigger lazy load...")
            for box in boxes:
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", box)
                time.sleep(SCROLL_PAUSE)
            time.sleep(1)

            seen = set()
            urls_with_names = []
            links = gallery.find_elements(By.CSS_SELECTOR, ".thumb a.mw-file-description.image, .thumb a.image")
            for a in links:
                href = a.get_attribute("href")
                if not href or "static.wikia" not in href or "wikia.nocookie" not in href or href in seen:
                    continue
                seen.add(href)
                name = extract_filename_from_url(href)
                urls_with_names.append((href, name, ""))
            if not urls_with_names:
                imgs = gallery.find_elements(By.CSS_SELECTOR, ".thumb img")
                for img in imgs:
                    src = img.get_attribute("src") or img.get_attribute("data-src")
                    if not src or src in seen:
                        continue
                    seen.add(src)
                    name = extract_filename_from_url(src)
                    urls_with_names.append((src, name, ""))

            print(f"Collected {len(urls_with_names)} image URLs.")
        except Exception as e:
            print(f"Scrape error: {e}")
            if attempt == args.max_retries:
                driver.quit()
                return 1
            time.sleep(2)
            continue

        ok = 0
        fail = 0
        for url, name, _ in urls_with_names:
            fname = safe_filename(name)
            if not re.search(r"\.(png|jpg|jpeg|gif|webp)$", fname, re.I):
                fname = fname + ".png"
            path = out_dir / fname
            if path.exists():
                ok += 1
                continue
            try:
                r = session.get(url, timeout=30, stream=True)
                r.raise_for_status()
                with open(path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
                ok += 1
                print(f"  ok: {path.name}")
            except Exception as e:
                fail += 1
                print(f"  fail {path.name}: {e}")
            time.sleep(0.15)

        driver.quit()
        current_count = len(list(out_dir.glob("*.*")))
        print(f"Round {attempt}: {ok} new/skip, {fail} fail. Total in dir: {current_count}")
        if current_count >= EXPECTED_IMAGES:
            print(f"Done. Output: {out_dir}")
            return 0
        if attempt < args.max_retries:
            print("Reopening browser for next round...")
            driver = None
            try:
                try:
                    ChromeDriverManager = wdm.chrome.ChromeDriverManager
                except AttributeError:
                    from webdriver_manager.chrome import ChromeDriverManager
                service = Service(ChromeDriverManager().install())
                driver = selenium.webdriver.Chrome(service=service, options=options)
            except Exception:
                try:
                    from selenium.webdriver.edge.service import Service as EdgeService
                    from selenium.webdriver.edge.options import Options as EdgeOptions
                    edge_opts = EdgeOptions()
                    if args.headless:
                        edge_opts.add_argument("--headless=new")
                    edge_opts.add_argument("--no-sandbox")
                    try:
                        EdgeDriverManager = wdm.microsoft.EdgeChromiumDriverManager
                    except AttributeError:
                        from webdriver_manager.microsoft import EdgeChromiumDriverManager as EdgeDriverManager
                    service = EdgeService(EdgeDriverManager().install())
                    driver = selenium.webdriver.Edge(service=service, options=edge_opts)
                except Exception:
                    pass
            if driver is None and shutil.which("chromedriver"):
                try:
                    driver = selenium.webdriver.Chrome(service=Service(shutil.which("chromedriver")), options=options)
                except Exception:
                    pass
            if driver is None:
                print("Could not reopen browser. Stopping retries.")
                break
            driver.implicitly_wait(5)
            wait = WebDriverWait(driver, PAGE_LOAD_WAIT)

    print(f"After {args.max_retries} rounds have {current_count}/{EXPECTED_IMAGES}. Output: {out_dir}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
