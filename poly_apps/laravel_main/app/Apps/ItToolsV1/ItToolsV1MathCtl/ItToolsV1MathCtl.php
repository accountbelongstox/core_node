<?php

namespace App\Apps\ItToolsV1\ItToolsV1MathCtl;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Apps\ItToolsV1\ItToolsV1Gvar\ItToolsV1Constants;

class ItToolsV1MathCtl extends Controller
{
    use ApiResponse;

    public function evaluate(Request $request)
    {
        $request->validate([
            'expression' => 'required|string',
            'precision' => 'sometimes|integer|min:0|max:20'
        ]);

        $expression = $request->input('expression');
        $precision = $request->input('precision', 10);

        try {
            $expression = preg_replace('/[^0-9+\-*\/().^ ]/', '', $expression);
            $expression = str_replace('^', '**', $expression);

            eval('$result = ' . $expression . ';');

            if ($precision > 0) {
                $result = round($result, $precision);
            }

            return $this->success([
                'result' => $result,
                'expression' => $request->input('expression')
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                'Invalid expression: ' . $e->getMessage(),
                null,
                500
            );
        }
    }

    public function percentage(Request $request)
    {
        $request->validate([
            'operation' => 'required|in:percent_of,percentage_change,what_percent',
            'value1' => 'required|numeric',
            'value2' => 'required|numeric'
        ]);

        $operation = $request->input('operation');
        $value1 = $request->input('value1');
        $value2 = $request->input('value2');

        try {
            switch ($operation) {
                case 'percent_of':
                    $result = ($value1 / 100) * $value2;
                    $formula = "{$value1}% of {$value2} = {$result}";
                    break;

                case 'percentage_change':
                    $result = (($value2 - $value1) / $value1) * 100;
                    $formula = "Change from {$value1} to {$value2} = {$result}%";
                    break;

                case 'what_percent':
                    $result = ($value1 / $value2) * 100;
                    $formula = "{$value1} is {$result}% of {$value2}";
                    break;

                default:
                    throw new \Exception('Invalid operation');
            }

            return $this->success([
                'result' => round($result, 2),
                'formula' => $formula
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function eta(Request $request)
    {
        $request->validate([
            'totalItems' => 'required|integer|min:1',
            'completedItems' => 'required|integer|min:0',
            'elapsedTime' => 'required|integer|min:0',
            'unit' => 'sometimes|in:seconds,minutes,hours'
        ]);

        $totalItems = $request->input('totalItems');
        $completedItems = $request->input('completedItems');
        $elapsedTime = $request->input('elapsedTime');
        $unit = $request->input('unit', 'seconds');

        try {
            if ($completedItems == 0) {
                throw new \Exception('Cannot calculate ETA with 0 completed items');
            }

            $itemsPerSecond = $completedItems / $elapsedTime;
            $remainingItems = $totalItems - $completedItems;
            $remainingTime = $remainingItems / $itemsPerSecond;
            $eta = $elapsedTime + $remainingTime;

            $estimatedCompletion = now()->addSeconds((int)$remainingTime)->toIso8601String();

            return $this->success([
                'eta' => round($eta, 2),
                'remainingTime' => round($remainingTime, 2),
                'estimatedCompletion' => $estimatedCompletion,
                'itemsPerSecond' => round($itemsPerSecond, 4)
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }

    public function benchmark(Request $request)
    {
        $request->validate([
            'operation' => 'required|string',
            'iterations' => 'sometimes|integer|min:1|max:1000000',
            'data' => 'sometimes|string'
        ]);

        $operation = $request->input('operation');
        $iterations = $request->input('iterations', 1000);
        $data = $request->input('data', '');

        try {
            $startTime = microtime(true);
            $startMemory = memory_get_usage();

            for ($i = 0; $i < $iterations; $i++) {
                switch ($operation) {
                    case 'string_concat':
                        $result = $data . $i;
                        break;
                    case 'array_push':
                        $arr = [];
                        array_push($arr, $i);
                        break;
                    case 'math_calc':
                        $result = sqrt($i) * 2;
                        break;
                    case 'json_encode':
                        $arr = ['index' => $i, 'data' => $data];
                        $result = json_encode($arr);
                        break;
                    case 'hash':
                        $result = md5($data . $i);
                        break;
                    default:
                        $result = $i;
                }
            }

            $endTime = microtime(true);
            $endMemory = memory_get_usage();

            $executionTime = ($endTime - $startTime) * 1000;
            $memoryUsed = $endMemory - $startMemory;
            $opsPerSecond = $iterations / ($endTime - $startTime);

            return $this->success([
                'operation' => $operation,
                'iterations' => $iterations,
                'executionTimeMs' => round($executionTime, 2),
                'executionTimeS' => round($executionTime / 1000, 4),
                'memoryUsed' => $memoryUsed,
                'memoryUsedMB' => round($memoryUsed / 1024 / 1024, 4),
                'opsPerSecond' => round($opsPerSecond, 2),
                'avgTimePerOp' => round($executionTime / $iterations, 6)
            ]);
        } catch (\Exception $e) {
            return $this->codedError(
                ItToolsV1Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }
}
