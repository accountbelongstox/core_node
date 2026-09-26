"""Generate CodeMart placeholder illustrations through the pycore AI image gateway.

Each image is produced from a text prompt, center-cropped to its aspect ratio,
resized to its target width, and saved as a compressed WebP next to this script
(images/<name>.webp). Existing files are kept unless --force or --only is given.

Usage: python3 generate_cm_images.py [--force] [--only name1,name2] [--provider openrouter]
"""

import argparse
import base64
import io
import os
import sys

from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..', '..', '..'))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'images')
WEBP_QUALITY = 76
STYLE = (
    'flat vector illustration, modern SaaS product style, soft blue and teal palette '
    'with small warm orange accents, clean light background, gentle gradients, '
    'crisp geometric shapes, high detail, no text, no letters, no words, no logos, no watermark'
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--only', default='')
    parser.add_argument('--provider', default='')
    args = parser.parse_args()
    only = {name.strip() for name in args.only.split(',') if name.strip()}

    sys.path.insert(0, REPO_ROOT)
    from pycore.pyctl.ai.ai_gateway import generate_image

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    failures = 0
    for name, aspect, target_width, subject in IMAGES:
        if only and name not in only:
            continue
        output_path = os.path.join(OUTPUT_DIR, name + '.webp')
        if os.path.exists(output_path) and not args.force and not only:
            print(f'skip {name} (exists)')
            continue
        result = generate_image(prompt=f'{subject}, {STYLE}', size=aspect, source='codemart-placeholder', provider=args.provider or None)
        if not result.get('success') or not result.get('image_base64'):
            failures += 1
            print(f'fail {name}: {result.get("error")}')
            continue
        image = _crop_resize(base64.b64decode(result['image_base64']), aspect, target_width)
        image.save(output_path, 'WEBP', quality=WEBP_QUALITY, method=6)
        print(f'ok {name} {image.size[0]}x{image.size[1]} {os.path.getsize(output_path) // 1024}KB via {result.get("provider")}')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
