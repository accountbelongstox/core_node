<?php

namespace App\Apps\RelayV2\RelayV2Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

final class RelayV2DomainException extends HttpException
{
    private string $relayErrorCode;

    public function __construct(string $errorCode, int $statusCode = 400, array $replace = [])
    {
        $this->relayErrorCode = $errorCode;
        parent::__construct($statusCode, __('relay_v2.'.$errorCode, $replace));
    }

    public function relayErrorCode(): string
    {
        return $this->relayErrorCode;
    }
}
