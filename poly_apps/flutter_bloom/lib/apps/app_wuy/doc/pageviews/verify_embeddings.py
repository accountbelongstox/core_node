#!/usr/bin/env python3
"""
Verify that metadata has been embedded in HTML files
"""

import os
import glob

# Mapping information
manual_mappings = {
    '01_profile_page.png': '../pageviewshtmlcodebuddy/personal-info.html',
    '02_about_us_page.png': '../pageviewshtmlcodebuddy/about.html',
    '03_history_tracking_page.png': '../pageviewshtmlcodebuddy/history-tracks.html',
    '04_map_page.png': '../pageviewshtmlcodebuddy/map.html',
    '05_friend_info_page.png': '../pageviewshtmlcodebuddy/friend-info.html',
    '06_friends_list_page.png': '../pageviewshtmlcodebuddy/friends-list.html',
    '07_my_profile_page.png': '../pageviewshtmlcodebuddy/mine.html',
    '08_find_friends_page.png': '../pageviewshtmlcodebuddy/search-friend.html',
    '09_registration_page.png': '../pageviewshtmlcodebuddy/register.html',
    '10_add_friend_page.png': '../pageviewshtmlcodebuddy/add-friend.html',
    '11_login_page.png': '../pageviewshtmlcodebuddy/login.html',
    '12_network_records_page.png': '../pageviewshtmlcodebuddy/network-records.html',
    '13_chat_page.png': '../pageviewshtmlcodebuddy/chat.html',
    '14_search_functionality.png': '../pageviewshtmlcodebuddy/search-friend.html'
}

def check_metadata_in_html(html_file):
    """Check if metadata exists in HTML file"""
    try:
        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check for metadata markers
        has_metadata = 'AI-READABLE METADATA' in content
        has_base64 = 'data:image/png;base64' in content
        has_prototype_div = 'prototype-image-reference' in content

        return {
            'has_metadata': has_metadata,
            'has_base64': has_base64,
            'has_prototype_div': has_prototype_div,
            'file_size': len(content)
        }
    except Exception as e:
        return {
            'error': str(e),
            'file_size': 0
        }

def main():
    print("Image-HTML Metadata Embedding Verification")
    print("=" * 60)

    embedded_count = 0
    total_count = len(manual_mappings)

    for image_file, html_file in manual_mappings.items():
        print(f"\nChecking: {image_file} → {html_file}")

        # Check if files exist
        if not os.path.exists(image_file):
            print(f"  Image file: MISSING")
            continue

        if not os.path.exists(html_file):
            print(f"  HTML file: MISSING")
            continue

        # Check metadata
        result = check_metadata_in_html(html_file)

        if 'error' in result:
            print(f"  Status: ERROR - {result['error']}")
        else:
            print(f"  File size: {result['file_size']:,} characters")

            if result['has_metadata'] and result['has_base64'] and result['has_prototype_div']:
                print(f"  Status: EMBEDDED SUCCESSFULLY")
                embedded_count += 1
            else:
                print(f"  Status: PARTIAL/MISSING")
                print(f"    Metadata present: {result['has_metadata']}")
                print(f"    Base64 present: {result['has_base64']}")
                print(f"    Prototype div: {result['has_prototype_div']}")

    print(f"\n" + "=" * 60)
    print(f"Verification Summary:")
    print(f"  Successfully embedded: {embedded_count}/{total_count}")
    print(f"  Success rate: {embedded_count/total_count*100:.1f}%")

    # List all HTML files that have metadata
    print(f"\nHTML files with embedded metadata:")
    html_dir = "../pageviewshtmlcodebuddy"
    if os.path.exists(html_dir):
        for html_file in glob.glob(os.path.join(html_dir, "*.html")):
            result = check_metadata_in_html(html_file)
            if result.get('has_metadata'):
                file_name = os.path.basename(html_file)
                print(f"  - {file_name} ({result['file_size']:,} chars)")

if __name__ == "__main__":
    main()