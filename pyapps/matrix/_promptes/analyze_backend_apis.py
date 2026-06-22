"""
Analyze all backend API routes in pyMatrix project
"""
import re
import json
from pathlib import Path
from typing import List, Dict

def extract_routes_from_file(file_path: Path) -> List[Dict[str, str]]:
    """Extract API routes from a single route file"""
    routes = []

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract router prefix
    prefix_match = re.search(r'router\s*=\s*APIRouter\(prefix="([^"]+)"', content)
    prefix = prefix_match.group(1) if prefix_match else ""

    # Find all route decorators
    route_patterns = [
        r'@router\.(get|post|put|patch|delete)\("([^"]+)"\)',
        r'@router\.(websocket)\("([^"]+)"\)',
    ]

    for pattern in route_patterns:
        matches = re.finditer(pattern, content, re.MULTILINE)
        for match in matches:
            method = match.group(1).upper()
            path = match.group(2)
            full_path = prefix + path

            # Try to find function name
            func_match = re.search(
                rf'{re.escape(match.group(0))}\s*async\s+def\s+(\w+)',
                content,
                re.MULTILINE
            )
            func_name = func_match.group(1) if func_match else "unknown"

            routes.append({
                "method": method,
                "path": full_path,
                "function": func_name,
                "file": file_path.name
            })

    return routes

def main():
    # API directory
    api_dir = Path(r"D:\programing\core_node\poly_apps\pyMatrix\api")

    all_routes = []

    # Process each route file
    for route_file in api_dir.glob("*_routes.py"):
        print(f"Processing {route_file.name}...")
        routes = extract_routes_from_file(route_file)
        all_routes.extend(routes)

    # Sort by file and path
    all_routes.sort(key=lambda x: (x['file'], x['path']))

    # Print summary
    print(f"\n=== Backend API Summary ===")
    print(f"Total endpoints found: {len(all_routes)}")
    print(f"\nEndpoints by file:")

    by_file = {}
    for route in all_routes:
        file = route['file']
        if file not in by_file:
            by_file[file] = []
        by_file[file].append(route)

    for file, routes in sorted(by_file.items()):
        print(f"\n{file}: {len(routes)} endpoints")
        for route in routes:
            print(f"  {route['method']:8} {route['path']:50} ({route['function']})")

    # Save to JSON
    output_file = api_dir.parent / "_promptes" / "backend_api_list.json"
    output_file.parent.mkdir(exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            "total_endpoints": len(all_routes),
            "endpoints": all_routes,
            "by_file": by_file
        }, f, indent=2, ensure_ascii=False)

    print(f"\nAPI list saved to: {output_file}")

if __name__ == "__main__":
    main()
