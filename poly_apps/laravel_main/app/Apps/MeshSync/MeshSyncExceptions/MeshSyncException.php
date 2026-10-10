<?php

namespace App\Apps\MeshSync\MeshSyncExceptions;

use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class MeshSyncException extends HttpException
{
    private string $meshErrorCode;

    public function __construct(string $errorCode, int $statusCode = 400, array $replace = [])
    {
        $this->meshErrorCode = $errorCode;
        parent::__construct($statusCode, __('mesh_sync.'.$errorCode, $replace));
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'data' => null,
            'error' => $this->getMessage(),
            'message' => $this->getMessage(),
            'error_code' => $this->meshErrorCode,
            'code' => $this->getStatusCode(),
            'status' => 'error',
        ], $this->getStatusCode());
    }
}
