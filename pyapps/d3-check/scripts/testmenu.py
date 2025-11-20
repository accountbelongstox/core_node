"""
Test Interactive Menu
Quick test to verify menu functionality
"""

from pathlib import Path
from interactive_menu import InteractiveMenu


def main():
    """Test menu functionality"""
    # Initialize menu with cache
    cache_file = Path.home() / ".core_node" / ".scripts" / "menu_test_cache.json"
    menu = InteractiveMenu(cache_file=cache_file)

    # Test 1: Single select menu
    print("\n=== Test 1: Single Select Menu ===")
    game_types = ["Diablo III", "Diablo IV"]

    selected_index = menu.show_single_select_menu(
        title="Game Type Selection Test",
        items=game_types,
        cache_key="test_game_type",
        default_index=0
    )

    print(f"\n✓ You selected: {game_types[selected_index]}")
    print(f"✓ Cached value: {menu.get_cached_value('test_game_type')}")

    input("\nPress Enter to continue to multi-select test...")

    # Test 2: Multi select menu
    print("\n=== Test 2: Multi Select Menu ===")
    templates = [
        "[ALL] - All templates",
        "Template 1 - Bag indicator",
        "Template 2 - Blacksmith indicator",
        "Template 3 - Kanai Cube indicator",
        "Template 4 - Item quality",
        "Template 5 - Slot empty"
    ]

    selected_indices = menu.show_multi_select_menu(
        title="Template Selection Test",
        items=templates,
        cache_key="test_templates",
        default_indices=[0]
    )

    print(f"\n✓ You selected {len(selected_indices)} item(s):")
    for idx in selected_indices:
        print(f"  - {templates[idx]}")
    print(f"✓ Cached values: {menu.get_cached_value('test_templates')}")

    print("\n=== Tests Complete ===")
    print("Run this script again to verify cache persistence!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest cancelled by user")
