<?php

namespace App\Apps\ItToolsV1\ItToolsV1MathCtl;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Apps\ItToolsV1\ItToolsV1Utils\ResponseHelper;
use App\Apps\ItToolsV1\ItToolsV1Gvar\Constants;

class ItToolsV1MathCtl extends Controller
{
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

            return ResponseHelper::success([
                'result' => $result,
                'expression' => $request->input('expression')
            ]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
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

            return ResponseHelper::success([
                'result' => round($result, 2),
                'formula' => $formula
            ]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
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

            return ResponseHelper::success([
                'eta' => round($eta, 2),
                'remainingTime' => round($remainingTime, 2),
                'estimatedCompletion' => $estimatedCompletion,
                'itemsPerSecond' => round($itemsPerSecond, 4)
            ]);
        } catch (\Exception $e) {
            return ResponseHelper::error(
                Constants::ERR_PROCESSING_ERROR,
                $e->getMessage(),
                null,
                500
            );
        }
    }
}
