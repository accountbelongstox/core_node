<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

/**
 * Thrown inside finance transactions to roll back and surface a machine
 * error code (localized by the UI) with an English message.
 */
class CodeMartV1FinanceException extends \RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $httpStatus = 422
    ) {
        parent::__construct($message);
    }
}
