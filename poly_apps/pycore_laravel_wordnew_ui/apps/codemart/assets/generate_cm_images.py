"""Generate CodeMart illustrations and icons through an AI image gateway.

Each entry is produced from a text prompt, center-cropped to its aspect ratio,
resized to its target width, and saved as a compressed WebP next to this script:
images/<name>.webp for the images group, icons/<name>.webp for the icons group.
Existing files are kept unless --force or --only is given.

Gateways: laravel (default) posts to /api/local/ai/image on the loopback Laravel
backend (AiGateway::generateImage, dashboard.auth loopback debug session, no token);
pycore calls the pycore ai_gateway in-process.

Usage: python3 generate_cm_images.py [--group images|icons] [--gateway laravel|pycore]
       [--dry-run] [--force] [--only name1,name2] [--provider openrouter]
"""

import argparse
import base64
import io
import json
import os
import sys
import urllib.error
import urllib.request

from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..', '..', '..'))
IMAGES_DIR = os.path.join(SCRIPT_DIR, 'images')
ICONS_DIR = os.path.join(SCRIPT_DIR, 'icons')
GROUP_IMAGES = 'images'
GROUP_ICONS = 'icons'
GATEWAY_LARAVEL = 'laravel'
GATEWAY_PYCORE = 'pycore'
LARAVEL_IMAGE_PATH = '/api/local/ai/image'
LARAVEL_HOST_KEY = 'loopback'
LARAVEL_PORT_KEY = 'laravel_api_backend'
LARAVEL_TIMEOUT_SECONDS = 600
ICON_SET_VERSION = 1
ICON_SIZE = 128
ICON_ASPECT = '1:1'
WEBP_QUALITY = 76
WEBP_MIN_QUALITY = 40
WEBP_QUALITY_STEP = 8
IMAGE_MAX_BYTES = 120 * 1024
ICON_MAX_BYTES = 30 * 1024
IMAGE_STYLE = (
    'flat vector illustration, modern SaaS product style, soft blue and teal palette '
    'with small warm orange accents, clean light background, gentle gradients, '
    'crisp geometric shapes, high detail, no text, no letters, no words, no logos, no watermark'
)
ICON_STYLE = (
    'flat vector app icon, one simple bold symbol centered with generous padding, '
    'rounded geometric shapes, deep blue and teal with one small warm orange accent, '
    'solid pale blue square background filling the whole image edge to edge, '
    'minimal detail, no shadow, no gradient, no text, no letters, no numbers, no words, no logos, no watermark'
)

IMAGES = [
    ('hero-delivery', '16:9', 1280, 'a winding road of glowing stepping stones leading from a paper blueprint to floating code panels and a laptop with a green checkmark, small flags along the path, unlabeled scene'),
    ('hero-marketplace', '16:9', 1280, 'a marketplace board of task cards with skill badges, developers picking cards, a large clean kanban wall'),
    ('hero-escrow', '16:9', 1280, 'secure escrow: a large shield protecting a plain gold vault box between a client office building and a developer workstation, coins without symbols'),
    ('about-mission', '4:3', 960, 'a small team of architect, developer and reviewer collaborating around a large blueprint of an application'),
    ('service-managed', '4:3', 720, 'large monitor showing an unlabeled milestone timeline with colored bars and a ring progress chart without numbers'),
    ('service-marketplace', '4:3', 720, 'task cards floating above a laptop with a checkmark on one accepted card'),
    ('service-review', '4:3', 720, 'code review: magnifying glass over code blocks with quality score stars and check marks'),
    ('service-escrow', '4:3', 720, 'blank paper document with only lines, a leather wallet and a padlock shield representing escrow and invoicing'),
    ('process-overview', '16:9', 1280, 'five connected stages from idea lightbulb to analysis chart to plan blueprint to coding laptop to delivered package'),
    ('estimate-calculator', '4:3', 720, 'calculator, stopwatch and bar chart estimating software project budget and duration'),
    ('showcase-projects', '16:9', 1280, 'gallery wall of finished software products: mobile app screens, dashboards and websites in frames'),
    ('auth-welcome', '3:4', 720, 'friendly workspace desk with laptop showing a secure login shield, plants and coffee cup'),
    ('download-devices', '4:3', 900, 'smartphone and tablet showing a project management app with notifications, floating on a soft background'),
    ('contact-support', '4:3', 720, 'support desk with chat bubbles and an envelope, friendly help center scene'),
    ('empty-workspace', '1:1', 480, 'an empty clean desk with a single blank clipboard and a small plant, calm minimal scene'),
    ('admin-console', '16:9', 1280, 'control room with shield, user cards, checklist and balance scale representing platform administration'),
]

ICONS = [
    ('nav-dashboard', 'a dashboard panel of four rounded tiles, one tile holding a small bar chart'),
    ('nav-marketplace', 'a small storefront with a striped awning'),
    ('nav-projects', 'a closed briefcase'),
    ('nav-project-create', 'a document sheet with a large plus sign'),
    ('nav-tasks', 'a checklist card with three rows of check boxes'),
    ('nav-reviews', 'a clipboard with one large check mark'),
    ('nav-architect', 'a drafting compass standing on a flat blueprint sheet'),
    ('nav-wallet', 'a wallet with a card peeking out'),
    ('nav-verification', 'a shield with a check mark'),
    ('nav-profile', 'a simple person bust silhouette with a plain shirt inside a circle'),
    ('nav-notifications', 'a bell'),
    ('nav-settings', 'a gear wheel'),
    ('feature-active-projects', 'a closed briefcase with a small round progress ring badge'),
    ('feature-escrow-funds', 'a shield in front of a stack of plain coins without symbols'),
    ('feature-open-tasks', 'a task card with an open circle and a pencil'),
    ('feature-marketplace-tasks', 'a task card showing code angle brackets'),
    ('feature-pending-reviews', 'a magnifying glass over a document with a small hourglass badge'),
    ('feature-wallet-balance', 'one large wallet with three plain coins without symbols stacked in front'),
    ('feature-unread-notifications', 'a bell with a small round badge dot'),
    ('category-simple', 'one single small cube'),
    ('category-medium', 'two plain square blocks stacked vertically'),
    ('category-complex', 'three cubes stacked as a small pyramid'),
    ('category-very-complex', 'a cluster of many interlocking cubes'),
    ('empty-projects', 'an empty open folder'),
    ('empty-tasks', 'an empty task board with blank cards and a small sprout'),
    ('empty-reviews', 'an empty inbox tray with a magnifying glass'),
    ('empty-notifications', 'a quiet bell with a small crescent moon'),
    ('empty-work', 'an empty desk tray with a small sprout'),
]

GROUPS = {
    GROUP_IMAGES: {
        'entries': IMAGES,
        'output_dir': IMAGES_DIR,
        'style': IMAGE_STYLE,
        'source': 'codemart-placeholder',
        'max_bytes': IMAGE_MAX_BYTES,
    },
    GROUP_ICONS: {
        'entries': [(name, ICON_ASPECT, ICON_SIZE, subject) for name, subject in ICONS],
        'output_dir': ICONS_DIR,
        'style': ICON_STYLE,
        'source': 'codemart-icon',
        'max_bytes': ICON_MAX_BYTES,
    },
}


def _aspect_ratio(aspect: str) -> float:
    width, height = aspect.split(':')
    return float(width) / float(height)


def _crop_resize(raw: bytes, aspect: str, target_width: int) -> Image.Image:
    image = Image.open(io.BytesIO(raw)).convert('RGB')
    ratio = _aspect_ratio(aspect)
    width, height = image.size
    if width / height > ratio:
        new_width = int(height * ratio)
        left = (width - new_width) // 2
        image = image.crop((left, 0, left + new_width, height))
    else:
        new_height = int(width / ratio)
        top = (height - new_height) // 2
        image = image.crop((0, top, width, top + new_height))
    target_height = int(round(target_width / ratio))
    return image.resize((target_width, target_height), Image.LANCZOS)


def _encode_webp(image: Image.Image, max_bytes: int) -> bytes | None:
    quality = WEBP_QUALITY
    while quality >= WEBP_MIN_QUALITY:
        buffer = io.BytesIO()
        image.save(buffer, 'WEBP', quality=quality, method=6)
        if buffer.tell() <= max_bytes:
            return buffer.getvalue()
        quality -= WEBP_QUALITY_STEP
    return None


def _laravel_image_url() -> str:
    from pycore.pyfoundations.service_contract import build_url, host, port

    return build_url('http', host(LARAVEL_HOST_KEY), port(LARAVEL_PORT_KEY), LARAVEL_IMAGE_PATH)


def _laravel_generate(url: str, prompt: str, aspect: str, source: str) -> dict:
    body = json.dumps({'prompt': prompt, 'size': aspect, 'source': source}).encode('utf-8')
    request = urllib.request.Request(url, data=body, method='POST', headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(request, timeout=LARAVEL_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as error:
        detail = error.read().decode('utf-8', errors='replace')[:300]
        return {'success': False, 'error': f'HTTP {error.code} {detail}'}
    except (urllib.error.URLError, OSError, ValueError) as error:
        return {'success': False, 'error': str(error)}


def _pycore_generator(provider: str):
    from pycore.pyctl.ai.ai_gateway import generate_image

    return lambda prompt, aspect, source: generate_image(prompt=prompt, size=aspect, source=source, provider=provider or None)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--group', choices=sorted(GROUPS), default=GROUP_IMAGES)
    parser.add_argument('--gateway', choices=[GATEWAY_LARAVEL, GATEWAY_PYCORE], default=GATEWAY_LARAVEL)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--only', default='')
    parser.add_argument('--provider', default='')
    args = parser.parse_args()
    group = GROUPS[args.group]
    only = {name.strip() for name in args.only.split(',') if name.strip()}
    unknown = only - {entry[0] for entry in group['entries']}
    failures = 0
    generate = None

    if unknown:
        parser.error(f'unknown {args.group} names: {", ".join(sorted(unknown))}')
    if args.provider and args.gateway != GATEWAY_PYCORE:
        parser.error('--provider applies to the pycore gateway only')

    sys.path.insert(0, REPO_ROOT)
    if args.group == GROUP_ICONS:
        print(f'icon set version {ICON_SET_VERSION}, {ICON_SIZE}x{ICON_SIZE}, max {ICON_MAX_BYTES // 1024} KB')
    if args.gateway == GATEWAY_LARAVEL:
        laravel_url = _laravel_image_url()
        print(f'gateway laravel {laravel_url}')
        generate = lambda prompt, aspect, source: _laravel_generate(laravel_url, prompt, aspect, source)
    elif not args.dry_run:
        generate = _pycore_generator(args.provider)
        print('gateway pycore ai_gateway')

    if not args.dry_run:
        os.makedirs(group['output_dir'], exist_ok=True)
    for name, aspect, target_width, subject in group['entries']:
        if only and name not in only:
            continue
        prompt = f'{subject}, {group["style"]}'
        output_path = os.path.join(group['output_dir'], name + '.webp')
        exists = os.path.exists(output_path)
        if args.dry_run:
            print(f'plan {name} {aspect} {target_width}px {"exists" if exists else "new"}: {prompt}')
            continue
        if exists and not args.force and not only:
            print(f'skip {name} (exists)')
            continue
        result = generate(prompt, aspect, group['source'])
        if not result.get('success') or not result.get('image_base64'):
            failures += 1
            print(f'fail {name}: {result.get("error")}')
            continue
        image = _crop_resize(base64.b64decode(result['image_base64']), aspect, target_width)
        encoded = _encode_webp(image, group['max_bytes'])
        if encoded is None:
            failures += 1
            print(f'fail {name}: WebP over {group["max_bytes"] // 1024} KB at quality {WEBP_MIN_QUALITY}')
            continue
        with open(output_path, 'wb') as handle:
            handle.write(encoded)
        print(f'ok {name} {image.size[0]}x{image.size[1]} {len(encoded) / 1024:.1f}KB via {result.get("provider")} {result.get("model")}')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
