#!/usr/bin/env python3
"""
Manual Image-HTML Mapping for App WUY
Based on the analysis of image names and HTML files
"""

# Manual mapping based on logical associations
manual_mappings = {
    '01_profile_page.png': 'personal-info.html',
    '02_about_us_page.png': 'about.html',
    '03_history_tracking_page.png': 'history-tracks.html',
    '04_map_page.png': 'map.html',
    '05_friend_info_page.png': 'friend-info.html',
    '06_friends_list_page.png': 'friends-list.html',
    '07_my_profile_page.png': 'mine.html',
    '08_find_friends_page.png': 'search-friend.html',
    '09_registration_page.png': 'register.html',
    '10_add_friend_page.png': 'add-friend.html',
    '11_login_page.png': 'login.html',
    '12_network_records_page.png': 'network-records.html',
    '13_chat_page.png': 'chat.html',
    '14_search_functionality.png': 'search-friend.html'
}

def process_manual_mappings():
    """
    Process the manual mappings by creating individual commands
    """
    import os

    pageviews_dir = "."
    html_dir = "../pageviewshtmlcodebuddy"

    print("Manual Image-HTML Mappings:")
    print("=" * 80)

    for image_file, html_file in manual_mappings.items():
        image_path = os.path.join(pageviews_dir, image_file)
        html_path = os.path.join(html_dir, html_file)

        print(f"{image_file} → {html_file}")

        # Check if files exist
        if os.path.exists(image_path) and os.path.exists(html_path):
            print(f"  ✅ Both files exist")
            # Create command for manual execution
            print(f"  Command: python embed_image_metadata.py --image {image_path} --html {html_path}")
        else:
            if not os.path.exists(image_path):
                print(f"  ❌ Image file missing: {image_path}")
            if not os.path.exists(html_path):
                print(f"  ❌ HTML file missing: {html_path}")
        print()

if __name__ == "__main__":
    process_manual_mappings()