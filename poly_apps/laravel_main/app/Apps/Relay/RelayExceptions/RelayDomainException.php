<?php

namespace App\Apps\Relay\RelayExceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

final class RelayDomainException extends HttpException
{
    private string $relayErrorCode;

    public function __construct(string $errorCode, int $statusCode = 400, array $replace = [])
    {
        $this->relayErrorCode = $errorCode;
        parent::__construct($statusCode, __('relay.'.$errorCode, $replace));
    }

    public function relayErrorCode(): string
    {
        return $this->relayErrorCode;
    }
}
