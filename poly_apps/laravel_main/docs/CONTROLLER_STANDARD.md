# Controller API Response Standard

## MANDATORY for ALL Controllers

### 1. Use ApiResponse Trait

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;

class YourController extends Controller
{
    use ApiResponse;

    // Your methods here
}
```

### 2. Standardized Response Methods

```php
// Success response
return $this->success($data, 'Success message');

// Error response
return $this->error('Error message', 400);

// Unauthorized (401)
return $this->unauthorized();

// Forbidden (403)
return $this->forbidden();

// Not Found (404)
return $this->notFound('Resource not found');

// Validation Error (422)
return $this->validationError($errors, 'Validation failed');
```

### 3. Authentication Pattern

**BEFORE (WRONG - DO NOT USE):**
```php
public function index(Request $request): JsonResponse
{
    $user = $request->user();

    if (!$user) {
        return response()->json([
            'message' => 'Unauthorized',
            'code' => 401,
            'status' => 'error',
        ], 401);
    }

    if (!$user->isAdmin()) {
        return response()->json([
            'message' => 'Forbidden',
            'code' => 403,
            'status' => 'error',
        ], 403);
    }

    // Business logic
}
```

**AFTER (CORRECT - USE THIS):**
```php
public function index(Request $request): JsonResponse
{
    $user = AuthHelper::requireAdmin($request);

    if (!$user) {
        $errorType = AuthHelper::getAuthErrorType($request, true);
        if ($errorType === 'unauthorized') {
            return $this->unauthorized();
        }
        return $this->forbidden();
    }

    // Business logic
    return $this->success($data, 'Success message');
}
```

### 4. Complete Example

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Resource;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;

class ResourceController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAdmin($request);

        if (!$user) {
            $errorType = AuthHelper::getAuthErrorType($request, true);
            if ($errorType === 'unauthorized') {
                return $this->unauthorized();
            }
            return $this->forbidden();
        }

        $resources = Resource::all();
        return $this->success($resources, 'Resources retrieved successfully');
    }

    public function store(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAdmin($request);

        if (!$user) {
            $errorType = AuthHelper::getAuthErrorType($request, true);
            if ($errorType === 'unauthorized') {
                return $this->unauthorized();
            }
            return $this->forbidden();
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'value' => 'required|string',
        ]);

        $resource = Resource::create($validated);
        return $this->success($resource, 'Resource created successfully', 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $resource = Resource::find($id);

        if (!$resource) {
            return $this->notFound('Resource not found');
        }

        return $this->success($resource, 'Resource retrieved successfully');
    }
}
```

### 5. Rules

1. **NO try-catch blocks** - Trust Laravel framework validation and database operations
2. **NO direct response()->json()** - Always use trait methods
3. **Use AuthHelper** - For all authentication checks
4. **Consistent format** - All responses follow same structure
5. **All child apps MUST follow** - This is mandatory across all modules
