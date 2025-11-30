<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


use App\Models\User;
use Illuminate\Testing\Fluent\AssertableJson;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

function publicAssertJson($response, $test)
{
    // $response->assertSuccessful();
    if ($response->status() === 500) {
        $test->fail('Unexpected 500 server error: ' . $response->getContent());
    }
    if ($response->status() !== 200) {
        echo "Error:------------------------------- ";
        dump($response->json());
    }
    $response->assertJson(
        fn(AssertableJson $json) =>
        $json->has('status', )
            ->etc()
    );
}

beforeEach(function () {
    // Create a test user
    $user = User::factory()->create([
        'nickname' => 'Test User',
        'username' => 'testuser',
        'rolelevel' => 0,
        'rolename' => 'user',
        'email' => 'test@example.com',
        'password' => Hash::make('password123'),
    ]);

    // Login and get token
    $response = $this->postJson('/api/login', [
        'username' => 'testuser',
        'password' => 'password123'
    ]);

    $response->assertStatus(200);
    $this->token = $response->json('token');
    echo $this->token;
    // $this->user = $user;
});

// System Status Tests
test('can get system status', function () {
    $response = $this->getJson('/api/get_system_status');
    $response->assertStatus(200);
});

// Authentication Tests
test('user can login with valid credentials', function () {
    $response = $this->postJson('/api/login', [
        'username' => 'testuser',
        'password' => 'password123'
    ]);

    $response->assertStatus(200)
        ->assertJsonStructure(['token']);
});

test('authenticated user can get their profile', function () {
    $response = $this->withHeaders([
        'Authorization' => 'Bearer ' . $this->token,
        'Accept' => 'application/json'
    ])->getJson('/api/user');

    $response->assertStatus(200)
        ->assertJson(
            fn(AssertableJson $json) =>
            $json->where('username', 'testuser')
                ->where('email', 'test@example.com')
                ->etc()
        );
});

// Dictionary Group Tests
test('authenticated user can create dictionary group', function () {
    $response = $this->withHeaders([
        'Authorization' => 'Bearer ' . $this->token,
        'Accept' => 'application/json'
    ])->postJson('/api/dict/create_group', [
                'gname' => 'Test Group',
                'gcontent' => 'Test Description',
                'gwords' => "
        Testing Laravel Sanctum Authentication and Protected Routes with Pest
To test your Laravel API routes that are protected by Sanctum authentication, you'll need to:
First test the login to get an access token
Then use that token to test your protected routes
Here's how to structure your Pest tests:"
            ]);

    publicAssertJson($response, $this);
});

test('authenticated user can query all groups', function () {
    $response = $this->withHeaders([
        'Authorization' => 'Bearer ' . $this->token,
        'Accept' => 'application/json'
    ])->getJson('/api/dict/query_all_groups');

    publicAssertJson($response, $this);
});

test('authenticated user can query group by name', function () {
    $response = $this->withHeaders([
        'Authorization' => 'Bearer ' . $this->token,
        'Accept' => 'application/json'
    ])->postJson('/api/dict/query_group_by_name', [
                'gname' => 'Test Group'
            ]);
    publicAssertJson($response, $this);
});
test('authenticated user can create personal dictionary', function () {
    $response = $this->withHeaders([
        'Authorization' => 'Bearer ' . $this->token,
        'Accept' => 'application/json'
    ])->postJson('/api/dict/create_personal_dictionary', [
        'dictionaries' => 'authenticated user can create personal dictionary',
    ]);

    publicAssertJson($response, $this);
});

test('authenticated user can query personal dictionary', function () {
    $response = $this->withHeaders([
        'Authorization' => 'Bearer ' . $this->token,
        'Accept' => 'application/json'
    ])->getJson('/api/dict/query_personal_dictionary');

    publicAssertJson($response, $this);
});

test('authenticated user can delete personal dictionary by id', function () {
    // First create a dictionary entry
    $createResponse = $this->withHeaders([
        'Authorization' => 'Bearer ' . $this->token,
        'Accept' => 'application/json'
    ])->postJson('/api/dict/create_personal_dictionary', [
        'dictionaries' => 'authenticated user can delete personal dictionary by id'
    ]);

    $id = $createResponse->json('id');

    $response = $this->withHeaders([
        'Authorization' => 'Bearer ' . $this->token,
        'Accept' => 'application/json'
    ])->postJson('/api/dict/delete_personal_dictionary_by_id', [
        'id' => $id
    ]);

    $response->assertStatus(200);
});

// Word Status Tests
test('authenticated user can update word learning status', function () {
    $response = $this->withHeaders([
        'Authorization' => 'Bearer ' . $this->token,
        'Accept' => 'application/json'
    ])->postJson('/api/dict/up_learned', [
        'word' => 'test',
    ]);

    publicAssertJson($response, $this);
});

test('authenticated user can update word read status', function () {
    $response = $this->withHeaders([
        'Authorization' => 'Bearer ' . $this->token,
        'Accept' => 'application/json'
    ])->postJson('/api/dict/up_read', [
        'word' => 'test',
    ]);

    publicAssertJson($response, $this);
});

// test('authenticated user can update word weight', function () {
//     $response = $this->withHeaders([
//         'Authorization' => 'Bearer ' . $this->token,
//         'Accept' => 'application/json'
//     ])->postJson('/api/dict/up_weight', [
//         'word' => 'test',
//         'weight' => 5
//     ]);

//     $response->assertStatus(200);
// });

// // Authorization Tests
// test('unauthenticated users cannot access protected routes', function () {
//     $routes = [
//         '/api/user',
//         '/api/dict/create_group',
//         '/api/dict/query_all_groups',
//         '/api/dict/create_personal_dictionary',
//         '/api/dict/query_personal_dictionary',
//         '/api/dict/up_learned',
//         '/api/dict/up_read',
//         '/api/dict/up_weight'
//     ];

//     foreach ($routes as $route) {
//         $response = $this->withHeaders([
//             'Accept' => 'application/json'
//         ])->postJson($route);

//         $response->assertStatus(401);
//     }
// });
// test('authenticated user can logout', function () {
//     $response = $this->withHeaders([
//         'Authorization' => 'Bearer ' . $this->token,
//         'Accept' => 'application/json'
//     ])->postJson('/api/logout');

//     $response->assertStatus(200);
// });