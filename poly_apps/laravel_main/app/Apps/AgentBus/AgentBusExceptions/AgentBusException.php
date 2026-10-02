<?php

namespace App\Apps\AgentBus\AgentBusExceptions;

use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class AgentBusException extends HttpException
{
    private string $busErrorCode;

    private array $details;

    public function __construct(string $errorCode, int $statusCode = 400, array $replace = [], array $details = [])
    {
        $this->busErrorCode = $errorCode;
        $this->details = $details;
        parent::__construct($statusCode, __('agent_bus.'.$errorCode, $replace));
    }

    public function busErrorCode(): string
    {
        return $this->busErrorCode;
    }

    public function details(): array
    {
        return $this->details;
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'data' => $this->details ?: null,
            'error' => $this->getMessage(),
            'message' => $this->getMessage(),
            'error_code' => $this->busErrorCode,
            'code' => $this->getStatusCode(),
            'status' => 'error',
        ], $this->getStatusCode());
    }
}
