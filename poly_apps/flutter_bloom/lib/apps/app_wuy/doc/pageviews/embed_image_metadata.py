#!/usr/bin/env python3
"""
Image Metadata Embedder for HTML Files
Embeds base64 image data and metadata comments into HTML files for AI analysis.
"""

import argparse
import base64
import os
import sys
from pathlib import Path
import re


def get_image_mime_type(file_path):
    """
    Get the MIME type based on file extension.
    """
    extension = Path(file_path).suffix.lower()
    mime_types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    }
    return mime_types.get(extension, 'image/png')


def image_to_base64(image_path):
    """
    Convert an image file to base64 encoding string.
    """
    try:
        print(f"[DEBUG] Converting image to base64: {image_path}")

        if not os.path.exists(image_path):
            print(f"[DEBUG] Image file does not exist: {image_path}")
            return None

        print(f"[DEBUG] Image file exists, reading binary data...")
        with open(image_path, 'rb') as image_file:
            image_data = image_file.read()

        original_size = len(image_data)
        print(f"[DEBUG] Original image size: {original_size} bytes")

        print(f"[DEBUG] Encoding to base64...")
        base64_encoded = base64.b64encode(image_data).decode('utf-8')

        encoded_size = len(base64_encoded)
        print(f"[DEBUG] Base64 encoded size: {encoded_size} bytes")
        print(f"[DEBUG] Size increase ratio: {encoded_size / original_size:.2f}x")

        mime_type = get_image_mime_type(image_path)
        print(f"[DEBUG] Detected MIME type: {mime_type}")

        data_uri = f"data:{mime_type};base64,{base64_encoded}"
        print(f"[DEBUG] Data URI created successfully, length: {len(data_uri)} chars")

        return data_uri

    except Exception as e:
        print(f"[DEBUG] Error converting image {image_path}: {e}")
        print(f"[DEBUG] Exception type: {type(e).__name__}")
        import traceback
        print(f"[DEBUG] Full traceback: {traceback.format_exc()}")
        return None


def get_file_size(file_path):
    """Get file size in human readable format."""
    try:
        size_bytes = os.path.getsize(file_path)
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
    except:
        return "Unknown"


def find_html_head_end(html_content):
    """
    Find the end of head section to insert metadata.
    """
    # Look for </head> tag
    head_match = re.search(r'</head>', html_content, re.IGNORECASE)
    if head_match:
        return head_match.end()

    # If no head tag found, look for <body>
    body_match = re.search(r'<body', html_content, re.IGNORECASE)
    if body_match:
        return body_match.start()

    # If neither found, insert at beginning
    return 0


def embed_image_metadata(html_file_path, image_file_path, relative_image_path):
    """
    Embed base64 image data and metadata into HTML file.
    """
    try:
        print(f"[DEBUG] Starting metadata embedding process")
        print(f"[DEBUG] HTML file: {html_file_path}")
        print(f"[DEBUG] Image file: {image_file_path}")
        print(f"[DEBUG] Relative path: {relative_image_path}")

        # Check if files exist
        if not os.path.exists(html_file_path):
            print(f"[DEBUG] HTML file does not exist: {html_file_path}")
            return False, "HTML file not found"

        if not os.path.exists(image_file_path):
            print(f"[DEBUG] Image file does not exist: {image_file_path}")
            return False, "Image file not found"

        print(f"[DEBUG] Reading HTML content...")
        # Read HTML content
        with open(html_file_path, 'r', encoding='utf-8') as f:
            html_content = f.read()

        original_html_size = len(html_content)
        print(f"[DEBUG] Original HTML size: {original_html_size} characters")

        # Convert image to base64
        print(f"[DEBUG] Converting image to base64...")
        base64_data = image_to_base64(image_file_path)
        if not base64_data:
            print(f"[DEBUG] Failed to convert image to base64")
            return False, "Failed to convert image to base64"

        print(f"[DEBUG] Base64 conversion successful")

        # Get image info
        image_size = get_file_size(image_file_path)
        image_path_obj = Path(image_file_path)
        html_path_obj = Path(html_file_path)

        print(f"[DEBUG] Image path object: {image_path_obj}")
        print(f"[DEBUG] HTML path object: {html_path_obj}")

        # Calculate relative paths
        try:
            html_relative_path = html_path_obj.relative_to(Path.cwd())
            print(f"[DEBUG] HTML relative path from cwd: {html_relative_path}")
        except Exception as e:
            print(f"[DEBUG] Could not calculate HTML relative path: {e}")
            html_relative_path = str(html_path_obj)

        try:
            image_relative_path = image_path_obj.relative_to(Path.cwd())
            print(f"[DEBUG] Image relative path from cwd: {image_relative_path}")
        except Exception as e:
            print(f"[DEBUG] Could not calculate image relative path: {e}")
            image_relative_path = str(image_path_obj)

        print(f"[DEBUG] Creating metadata comment block...")
        # Create metadata comment block
        metadata_comment = f"""

<!--
========================================================================
AI-READABLE METADATA - PROTOTYPE IMAGE INFORMATION
========================================================================

HTML File Information:
- HTML Filename: {html_path_obj.name}
- HTML Relative Path (from project root): {html_relative_path}
- HTML Absolute Path: {html_path_obj.absolute()}

Source Image Information:
- Image Filename: {image_path_obj.name}
- Image Relative Path (from HTML file): {relative_image_path}
- Image Relative Path (from project root): {image_relative_path}
- Image Absolute Path: {image_path_obj.absolute()}
- Image File Size: {image_size}
- Image MIME Type: {get_image_mime_type(image_file_path)}

Base64 Encoded Image Data (for AI reference):
{base64_data}

Embed Information:
- Embed Date: {Path(html_file_path).stat().st_mtime}
- Purpose: This HTML was created based on the referenced prototype image
- Relationship: HTML implementation matches the visual design of the source image

Note: This metadata is embedded for AI analysis and reference purposes.
The base64 data can be used to reconstruct the original prototype image.
========================================================================
-->

<!-- Hidden prototype image for AI reference (display: none) -->
<div style="display: none;" id="prototype-image-reference" data-image-path="{relative_image_path}">
    <img src="{base64_data}" alt="Prototype: {image_path_obj.stem}"
         data-original-filename="{image_path_obj.name}"
         data-relative-path="{relative_image_path}"
         data-file-size="{image_size}"
         data-creation-purpose="HTML prototype reference for AI analysis" />
</div>

"""

        metadata_size = len(metadata_comment)
        print(f"[DEBUG] Metadata block size: {metadata_size} characters")

        # Find insertion point (end of head section)
        print(f"[DEBUG] Finding insertion point in HTML...")
        insertion_point = find_html_head_end(html_content)
        print(f"[DEBUG] Insertion point at character position: {insertion_point}")

        if insertion_point == 0:
            print(f"[DEBUG] Warning: No head or body tag found, inserting at beginning")
        elif insertion_point >= len(html_content):
            print(f"[DEBUG] Warning: Insertion point beyond HTML content, inserting at end")
            insertion_point = len(html_content)

        # Insert metadata
        print(f"[DEBUG] Inserting metadata into HTML...")
        new_html_content = (
            html_content[:insertion_point] +
            metadata_comment +
            html_content[insertion_point:]
        )

        new_html_size = len(new_html_content)
        print(f"[DEBUG] New HTML size: {new_html_size} characters")
        print(f"[DEBUG] Size increase: {new_html_size - original_html_size} characters")

        # Write updated HTML
        print(f"[DEBUG] Writing updated HTML to file...")
        with open(html_file_path, 'w', encoding='utf-8') as f:
            f.write(new_html_content)

        print(f"[DEBUG] HTML file updated successfully")
        return True, "Metadata embedded successfully"

    except Exception as e:
        print(f"[DEBUG] Error embedding metadata: {e}")
        print(f"[DEBUG] Exception type: {type(e).__name__}")
        import traceback
        print(f"[DEBUG] Full traceback: {traceback.format_exc()}")
        return False, f"Error embedding metadata: {e}"


def map_images_to_html(images_dir, html_dir):
    """
    Create mapping between images and HTML files based on naming patterns.
    """
    print(f"[DEBUG] Starting image-HTML mapping process")
    print(f"[DEBUG] Images directory: {images_dir}")
    print(f"[DEBUG] HTML directory: {html_dir}")

    try:
        image_files = list(Path(images_dir).glob("*.png"))
        html_files = list(Path(html_dir).glob("*.html"))

        print(f"[DEBUG] Found {len(image_files)} image files")
        print(f"[DEBUG] Found {len(html_files)} HTML files")

        print(f"[DEBUG] Image files: {[f.name for f in image_files]}")
        print(f"[DEBUG] HTML files: {[f.name for f in html_files]}")

    except Exception as e:
        print(f"[DEBUG] Error scanning directories: {e}")
        print(f"[DEBUG] Exception type: {type(e).__name__}")
        import traceback
        print(f"[DEBUG] Full traceback: {traceback.format_exc()}")
        return []

    mappings = []

    # Create mapping rules based on common patterns
    mapping_rules = {
        'profile': ['personal-info.html', 'mine.html'],
        'about': ['about.html'],
        'history': ['history-tracks.html'],
        'map': ['map.html'],
        'friend': ['friend-info.html', 'friends-list.html', 'add-friend.html', 'search-friend.html'],
        'my': ['mine.html', 'personal-info.html'],
        'find': ['search-friend.html'],
        'registration': ['register.html'],
        'add': ['add-friend.html'],
        'login': ['login.html'],
        'network': ['network-records.html'],
        'chat': ['chat.html'],
        'search': ['search-friend.html']
    }

    print(f"[DEBUG] Mapping rules: {len(mapping_rules)} keyword patterns defined")

    for i, image_file in enumerate(image_files):
        print(f"[DEBUG] Processing image {i+1}/{len(image_files)}: {image_file.name}")
        image_name = image_file.stem.lower()
        print(f"[DEBUG] Image stem: {image_name}")

        matched_htmls = []

        # Find matches based on mapping rules
        print(f"[DEBUG] Checking keyword matches...")
        for keyword, possible_htmls in mapping_rules.items():
            print(f"[DEBUG] Testing keyword: '{keyword}'")
            if keyword in image_name:
                print(f"[DEBUG] Keyword '{keyword}' found in image name")
                for html_name in possible_htmls:
                    html_path = Path(html_dir) / html_name
                    if html_path.exists():
                        print(f"[DEBUG] Found matching HTML: {html_name}")
                        matched_htmls.append(html_path)
                    else:
                        print(f"[DEBUG] HTML file not found: {html_name}")

        # If no matches found, try to match by index
        if not matched_htmls:
            print(f"[DEBUG] No keyword matches found, trying index matching...")
            try:
                index = int(image_name.split('_')[0]) - 1
                print(f"[DEBUG] Extracted index: {index}")
                if 0 <= index < len(html_files):
                    matched_htmls = [html_files[index]]
                    print(f"[DEBUG] Matched by index to: {html_files[index].name}")
                else:
                    print(f"[DEBUG] Index {index} out of range (0-{len(html_files)-1})")
            except Exception as e:
                print(f"[DEBUG] Index matching failed: {e}")

        # Add best match if multiple found
        if matched_htmls:
            print(f"[DEBUG] Found {len(matched_htmls)} potential matches")
            # Prefer exact name matches
            best_match = None
            for html_path in matched_htmls:
                html_name = html_path.stem.lower()
                print(f"[DEBUG] Testing HTML name match: '{html_name}'")
                if any(keyword in image_name for keyword in html_name.split('-')):
                    print(f"[DEBUG] Found exact name match: {html_path.name}")
                    best_match = html_path
                    break

            if not best_match:
                best_match = matched_htmls[0]
                print(f"[DEBUG] Using first available match: {best_match.name}")

            mappings.append((image_file, best_match))
            print(f"[DEBUG] Mapping added: {image_file.name} → {best_match.name}")
        else:
            print(f"[DEBUG] No matches found for image: {image_file.name}")

    print(f"[DEBUG] Mapping complete. Total mappings: {len(mappings)}")
    return mappings


def main():
    """
    Main function to process image-HTML mappings.
    """
    print(f"[DEBUG] Script started with arguments: {sys.argv}")

    parser = argparse.ArgumentParser(
        description='Embed image metadata into HTML files for AI analysis',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Process all images and HTML files
  python embed_image_metadata.py --images-dir ./pageviews --html-dir ./pageviewshtmlcodebuddy

  # Process specific image to HTML
  python embed_image_metadata.py --image profile_page.png --html about.html

  # Show mappings only (dry run)
  python embed_image_metadata.py --images-dir ./pageviews --html-dir ./pageviewshtmlcodebuddy --dry-run
        '''
    )

    parser.add_argument(
        '--images-dir',
        help='Directory containing PNG images'
    )

    parser.add_argument(
        '--html-dir',
        help='Directory containing HTML files'
    )

    parser.add_argument(
        '--image',
        help='Specific image file to process'
    )

    parser.add_argument(
        '--html',
        help='Specific HTML file to process'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show mappings only, do not modify files'
    )

    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable detailed debug output'
    )

    args = parser.parse_args()

    print(f"[DEBUG] Parsed arguments:")
    print(f"[DEBUG]   images_dir: {args.images_dir}")
    print(f"[DEBUG]   html_dir: {args.html_dir}")
    print(f"[DEBUG]   image: {args.image}")
    print(f"[DEBUG]   html: {args.html}")
    print(f"[DEBUG]   dry_run: {args.dry_run}")
    print(f"[DEBUG]   debug: {args.debug}")

    if args.images_dir and args.html_dir:
        # Process directory mapping
        print(f"[DEBUG] Processing directory mode")
        print(f"[DEBUG] Validating directories...")

        if not os.path.exists(args.images_dir):
            print(f"[DEBUG] Images directory does not exist: {args.images_dir}")
            sys.exit(1)

        if not os.path.exists(args.html_dir):
            print(f"[DEBUG] HTML directory does not exist: {args.html_dir}")
            sys.exit(1)

        print(f"[DEBUG] Directories validated, starting mapping process...")
        mappings = map_images_to_html(args.images_dir, args.html_dir)

        print(f"\nFound {len(mappings)} image-HTML mappings:")
        print("=" * 80)

        success_count = 0
        error_count = 0

        for i, (image_file, html_file) in enumerate(mappings, 1):
            print(f"\n[DEBUG] Processing mapping {i}/{len(mappings)}")
            print(f"[DEBUG] Image: {image_file}")
            print(f"[DEBUG] HTML: {html_file}")

            try:
                relative_path = os.path.relpath(image_file, Path(html_file).parent)
                print(f"[DEBUG] Calculated relative path: {relative_path}")

                print(f"{i:2d}. {image_file.name} → {html_file.name}")
                print(f"    Relative path: {relative_path}")

                if args.dry_run:
                    print(f"    [DRY RUN] Would embed metadata in: {html_file}")
                    success_count += 1
                else:
                    print(f"[DEBUG] Embedding metadata...")
                    success, message = embed_image_metadata(
                        str(html_file),
                        str(image_file),
                        relative_path
                    )
                    print(f"    Result: {'✅ Success' if success else '❌ Failed'} - {message}")

                    if success:
                        success_count += 1
                    else:
                        error_count += 1

            except Exception as e:
                print(f"[DEBUG] Error processing mapping {i}: {e}")
                print(f"    Result: ❌ Failed - {e}")
                error_count += 1

        print(f"\n[DEBUG] Processing complete")
        print(f"Summary: {success_count} successful, {error_count} failed")

    elif args.image and args.html:
        # Process specific files
        print(f"[DEBUG] Processing single file mode")
        print(f"[DEBUG] Validating files...")

        if not os.path.exists(args.image):
            print(f"[DEBUG] Image file does not exist: {args.image}")
            sys.exit(1)

        if not os.path.exists(args.html):
            print(f"[DEBUG] HTML file does not exist: {args.html}")
            sys.exit(1)

        print(f"[DEBUG] Files validated")

        try:
            relative_path = os.path.relpath(args.image, Path(args.html).parent)
            print(f"[DEBUG] Calculated relative path: {relative_path}")

            print(f"\nProcessing: {args.image} → {args.html}")
            print(f"Relative path: {relative_path}")

            if args.dry_run:
                print(f"[DRY RUN] Would embed metadata in: {args.html}")
            else:
                print(f"[DEBUG] Embedding metadata...")
                success, message = embed_image_metadata(args.html, args.image, relative_path)
                print(f"Result: {'✅ Success' if success else '❌ Failed'} - {message}")

        except Exception as e:
            print(f"[DEBUG] Error processing files: {e}")
            sys.exit(1)

    else:
        print("Error: Please provide either --images-dir and --html-dir, or --image and --html")
        parser.print_help()
        sys.exit(1)

    print(f"[DEBUG] Script execution completed")


if __name__ == "__main__":
    main()