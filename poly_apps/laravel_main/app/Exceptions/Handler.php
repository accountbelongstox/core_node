<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Throwable;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\QueryException;
use PDOException;
use Illuminate\Validation\ValidationException;
use Illuminate\Session\TokenMismatchException;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    /**
     * Render an exception into an HTTP response.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Throwable  $e
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function render($request, Throwable $e)
    {
        // Remove framework-specific headers
        header_remove('X-Powered-By');

        // Unified JSON error wrapper for API requests (including debug mode)
        if ($request->expectsJson()) {
            $status = $this->isHttpException($e) ? $e->getStatusCode() : 500;
            $debug = (bool) config('app.debug');

            $payload = [
                'success' => false,
                'data' => null,
                'exception' => get_class($e),
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ];

            if ($debug) {
                $payload['trace'] = $e->getTrace();
                $payload['traceText'] = $e->getTraceAsString();
            }

            return response()->json($payload, $status)
                ->header('Content-Type', 'application/json');
        }
        
        if (!config('app.debug')) {
            $status = 500;
            $message = 'Internal Server Error';
            $error = [
                'type' => 'ServerError',
                'message' => $message,
                'status' => $status,
            ];

            if ($e instanceof HttpException) {
                $status = $e->getStatusCode();
                switch ($status) {
                    case 404:
                        $error = [
                            'type' => 'NotFoundError',
                            'message' => 'Resource not found',
                            'status' => 404,
                        ];
                        break;
                    case 403:
                        $error = [
                            'type' => 'ForbiddenError',
                            'message' => 'Access forbidden',
                            'status' => 403,
                        ];
                        break;
                    case 401:
                        $error = [
                            'type' => 'UnauthorizedError',
                            'message' => 'Authentication required',
                            'status' => 401,
                        ];
                        break;
                    case 429:
                        $error = [
                            'type' => 'TooManyRequestsError',
                            'message' => 'Rate limit exceeded',
                            'status' => 429,
                        ];
                        break;
                }
            } elseif ($e instanceof AuthenticationException) {
                $error = [
                    'type' => 'UnauthorizedError',
                    'message' => 'Authentication required',
                    'status' => 401,
                ];
            } elseif ($e instanceof ValidationException) {
                $error = [
                    'type' => 'ValidationError',
                    'message' => 'Invalid input data',
                    'status' => 422,
                    'errors' => $this->formatValidationErrors($e),
                ];
            } elseif ($e instanceof TokenMismatchException) {
                $error = [
                    'type' => 'SecurityError',
                    'message' => 'Invalid security token',
                    'status' => 419,
                ];
            } elseif ($e instanceof QueryException || $e instanceof PDOException) {
                $error = [
                    'type' => 'ServerError',
                    'message' => 'Internal Server Error',
                    'status' => 500,
                ];
            }

            if ($request->expectsJson()) {
                return response()->json(['error' => $error], $error['status'])
                    ->header('Content-Type', 'application/json');
            }

            return response()->view('errors.generic', [
                'message' => $error['message'],
                'status' => $error['status'],
                'type' => $error['type']
            ], $error['status']);
        }

        return parent::render($request, $e);
    }

    /**
     * Format validation errors to match Express validator style
     */
    protected function formatValidationErrors(ValidationException $exception)
    {
        $errors = [];
        foreach ($exception->errors() as $field => $messages) {
            $errors[] = [
                'field' => $field,
                'message' => $messages[0],
                'value' => request()->input($field),
            ];
        }
        return $errors;
    }
} 