# Laravel Web Dashboard

Based on the page `_apps/laravel_main/public/debug-assets/debug_interface_template.html`, search for all JavaScript files referenced by this page. Search in two locations:
- `laravel_main/public`
- `poly_apps/laravel_main/app/Http/EnvironmentApiInfo`

Find all URLs used, compile into documentation, and check which endpoints are actually being used.

Example endpoint:
```
http://localhost:9000/api/public/avatar/alice?size=50
```

## Current Issue

In `poly_apps/laravel_main`, many parameters are not being parsed and used by the backend to return new images.

## Solution

Modify the system to:
1. Cache by keyword once
2. Do not cache by size, but PHP will crop and provide the correct size
3. If size and other parameters are not specified, default to returning the largest image
4. When caching, the backend will first cache the largest image (e.g., 512x512) so that when the frontend requests it, PHP can crop it in real-time.
