#!/usr/bin/env python3
"""
Batch embed metadata for all image-HTML mappings
"""

import os
import subprocess

# Manual mapping based on logical associations
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

def main():
    print("Batch Image-HTML Metadata Embedding")
    print("=" * 60)

    success_count = 0
    error_count = 0

    for image_file, html_file in manual_mappings.items():
        print(f"\nProcessing: {image_file} → {html_file}")

        # Check if files exist
        if not os.path.exists(image_file):
            print(f"  ERROR: Image file not found: {image_file}")
            error_count += 1
            continue

        if not os.path.exists(html_file):
            print(f"  ERROR: HTML file not found: {html_file}")
            error_count += 1
            continue

        # Run the embedding command
        try:
            cmd = ['python', 'embed_image_metadata.py', '--image', image_file, '--html', html_file]
            result = subprocess.run(cmd, capture_output=True, text=True, cwd='.')

            if result.returncode == 0:
                print(f"  SUCCESS: Metadata embedded")
                success_count += 1
            else:
                print(f"  ERROR: Embedding failed")
                print(f"  Error output: {result.stderr}")
                error_count += 1

        except Exception as e:
            print(f"  ERROR: {e}")
            error_count += 1

    print(f"\n" + "=" * 60)
    print(f"Batch processing complete:")
    print(f"  Successful: {success_count}")
    print(f"  Failed: {error_count}")
    print(f"  Total: {success_count + error_count}")

if __name__ == "__main__":
    main()