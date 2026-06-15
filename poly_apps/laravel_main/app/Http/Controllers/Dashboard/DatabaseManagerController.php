<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\DatabaseCredentialService;
use App\Services\Dashboard\DatabaseManagerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Dashboard Database Manager API. Guarded by the `dashboard.auth` middleware
 * (loopback debug bypass OR Sanctum). Thin controller -> DatabaseManagerService.
 */
class DatabaseManagerController extends Controller
{
    public function connections(): JsonResponse
    {
        return $this->ok(['connections' => DatabaseManagerService::connections()]);
    }

    public function status(Request $request): JsonResponse
    {
        return $this->ok(DatabaseManagerService::status($this->conn($request)));
    }

    public function tables(Request $request): JsonResponse
    {
        $connection = $this->conn($request);
        return $this->ok(['tables' => DatabaseManagerService::tables($connection)]);
    }

    public function structure(Request $request, string $table): JsonResponse
    {
        $connection = $this->conn($request);
        return $this->ok(['columns' => DatabaseManagerService::structure($connection, $table)]);
    }

    public function data(Request $request, string $table): JsonResponse
    {
        $connection = $this->conn($request);
        $page = (int) $request->query('page', 1);
        $perPage = (int) $request->query('per_page', 20);
        return $this->ok(DatabaseManagerService::data($connection, $table, $page, $perPage));
    }

    public function export(Request $request, string $table): Response
    {
        $connection = $this->conn($request);
        $format = (string) $request->query('format', 'csv');
        [$filename, $mime, $content] = DatabaseManagerService::export($connection, $table, $format);

        return response($content, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    public function import(Request $request, string $table): JsonResponse
    {
        $request->validate([
            'file' => 'required|file',
            'format' => 'nullable|in:csv,json',
            'mode' => 'nullable|in:append,replace',
            'connection' => 'nullable|string',
        ]);
        $connection = $this->conn($request);
        $format = (string) $request->input('format', 'csv');
        $mode = (string) $request->input('mode', 'append');
        $tmp = $request->file('file')->getRealPath();

        $result = DatabaseManagerService::import($connection, $table, $tmp, $format, $mode);
        return $this->ok($result, 'Imported ' . $result['imported'] . ' row(s)');
    }

    public function backup(Request $request): JsonResponse
    {
        $request->validate(['connection' => 'required|string']);
        $connection = DatabaseManagerService::connectionName((string) $request->input('connection'));
        return $this->ok(['backup' => DatabaseManagerService::backup($connection)], 'Backup created');
    }

    public function backups(Request $request): JsonResponse
    {
        $connection = $request->query('connection');
        $connection = $connection !== null && $connection !== ''
            ? DatabaseManagerService::connectionName((string) $connection)
            : null;
        return $this->ok(['backups' => DatabaseManagerService::listBackups($connection)]);
    }

    public function restore(string $id): JsonResponse
    {
        $result = DatabaseManagerService::restore($id);
        return response()->json(['success' => true, 'message' => $result['message']]);
    }

    public function deleteBackup(string $id): JsonResponse
    {
        DatabaseManagerService::deleteBackup($id);
        return response()->json(['success' => true]);
    }

    public function downloadBackup(string $id): BinaryFileResponse
    {
        $path = DatabaseManagerService::backupFilePath($id);
        return response()->download($path);
    }

    // ---- credentials (superuser/root password management) ------------------

    public function credentials(Request $request): JsonResponse
    {
        $connection = $this->conn($request);
        return $this->ok(DatabaseCredentialService::info($connection));
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'connection' => 'required|string',
            'new_password' => 'required|string|min:1',
            'user' => 'nullable|string',
        ]);
        $result = DatabaseCredentialService::changePassword(
            DatabaseManagerService::connectionName((string) $request->input('connection')),
            (string) $request->input('new_password'),
            $request->input('user') !== null ? (string) $request->input('user') : null
        );
        $message = $result['is_configured_account']
            ? 'Password changed and synced to Laravel config'
            : "Password changed for {$result['user']}";
        return $this->ok($result, $message);
    }

    public function createUser(Request $request): JsonResponse
    {
        $request->validate([
            'connection' => 'required|string',
            'username' => 'required|string|min:1|max:63',
            'password' => 'nullable|string',
        ]);
        $result = DatabaseCredentialService::createUser(
            DatabaseManagerService::connectionName((string) $request->input('connection')),
            (string) $request->input('username'),
            $request->input('password') !== null ? (string) $request->input('password') : null
        );
        return $this->ok($result, "Account {$result['username']} created");
    }

    public function dropUser(Request $request, string $username): JsonResponse
    {
        $result = DatabaseCredentialService::dropUser($this->conn($request), $username);
        return $this->ok($result, "Account {$result['username']} dropped");
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate(['connection' => 'required|string']);
        $result = DatabaseCredentialService::resetPassword(
            DatabaseManagerService::connectionName((string) $request->input('connection'))
        );
        return $this->ok($result, 'Password reset and synced to Laravel config');
    }

    // ---- helpers -----------------------------------------------------------

    /**
     * Resolve the request's connection to a Laravel connection name. The
     * dashboard sends descriptor KEYS (e.g. "main"); legacy callers may still
     * send the old main-connection alias "sqlite" — normalize via the whitelist.
     */
    private function conn(Request $request): string
    {
        $c = $request->query('connection', $request->input('connection'));
        $raw = $c !== null && $c !== '' ? (string) $c : (string) config('database.default');
        return DatabaseManagerService::connectionName($raw);
    }

    private function ok(array $data, ?string $message = null): JsonResponse
    {
        $payload = ['success' => true, 'data' => $data];
        if ($message !== null) {
            $payload['message'] = $message;
        }
        return response()->json($payload);
    }
}
