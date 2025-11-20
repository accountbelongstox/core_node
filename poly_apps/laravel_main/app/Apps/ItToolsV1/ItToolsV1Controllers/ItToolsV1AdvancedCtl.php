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

namespace App\Apps\ItToolsV1\ItToolsV1Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Apps\ItToolsV1\ItToolsV1Utils\ItToolsV1ImageUtil;
use App\Apps\ItToolsV1\ItToolsV1Utils\ItToolsV1CalculatorUtil;

class ItToolsV1AdvancedCtl extends ItToolsV1BaseCtl
{
    public function imageResize(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $file = $request->file('image');
            $width = $request->input('width');
            $height = $request->input('height');
            
            if (!$file || !$width || !$height) {
                return $this->error('Missing required parameters', null, 422);
            }
            
            $tempPath = $file->store('temp');
            $fullPath = storage_path('app/' . $tempPath);
            
            $result = ItToolsV1ImageUtil::resizeImage($fullPath, (int)$width, (int)$height);
            
            $base64 = base64_encode(file_get_contents($result['path']));
            
            unlink($fullPath);
            unlink($result['path']);
            
            return [
                'image_data' => 'data:image/png;base64,' . $base64,
                'original_size' => $result['original_size'],
                'new_size' => $result['new_size'],
                'file_size' => $result['file_size']
            ];
        });
    }
    
    public function imageRotate(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $file = $request->file('image');
            $angle = $request->input('angle', 90);
            
            if (!$file) {
                return $this->error('Image file required', null, 422);
            }
            
            $tempPath = $file->store('temp');
            $fullPath = storage_path('app/' . $tempPath);
            
            $result = ItToolsV1ImageUtil::rotateImage($fullPath, (int)$angle);
            
            $base64 = base64_encode(file_get_contents($result['path']));
            
            unlink($fullPath);
            unlink($result['path']);
            
            return [
                'image_data' => 'data:image/png;base64,' . $base64,
                'angle' => $result['angle']
            ];
        });
    }
    
    public function imageFlip(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $file = $request->file('image');
            $direction = $request->input('direction', 'horizontal');
            
            if (!$file) {
                return $this->error('Image file required', null, 422);
            }
            
            $tempPath = $file->store('temp');
            $fullPath = storage_path('app/' . $tempPath);
            
            $result = ItToolsV1ImageUtil::flipImage($fullPath, $direction);
            
            $base64 = base64_encode(file_get_contents($result['path']));
            
            unlink($fullPath);
            unlink($result['path']);
            
            return [
                'image_data' => 'data:image/png;base64,' . $base64,
                'direction' => $result['direction']
            ];
        });
    }
    
    public function imageExtractColors(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $file = $request->file('image');
            $numColors = $request->input('num_colors', 5);
            
            if (!$file) {
                return $this->error('Image file required', null, 422);
            }
            
            $tempPath = $file->store('temp');
            $fullPath = storage_path('app/' . $tempPath);
            
            $colors = ItToolsV1ImageUtil::extractColors($fullPath, (int)$numColors);
            
            unlink($fullPath);
            
            return [
                'colors' => $colors,
                'count' => count($colors)
            ];
        });
    }
    
    public function imageConvert(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $file = $request->file('image');
            $format = $request->input('format', 'png');
            
            if (!$file) {
                return $this->error('Image file required', null, 422);
            }
            
            $tempPath = $file->store('temp');
            $fullPath = storage_path('app/' . $tempPath);
            
            $result = ItToolsV1ImageUtil::convertImage($fullPath, $format);
            
            $base64 = base64_encode(file_get_contents($result['path']));
            
            unlink($fullPath);
            unlink($result['path']);
            
            return [
                'image_data' => 'data:image/' . $format . ';base64,' . $base64,
                'format' => $result['format'],
                'file_size' => $result['file_size']
            ];
        });
    }
    
    public function calculateAge(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $birthdate = $request->input('birthdate');
            
            if ($error = $this->validateRequired($request->all(), ['birthdate'])) {
                return $error;
            }
            
            return ItToolsV1CalculatorUtil::calculateAge($birthdate);
        });
    }
    
    public function calculateBMI(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $weight = $request->input('weight');
            $height = $request->input('height');
            $unit = $request->input('unit', 'metric');
            
            if ($error = $this->validateRequired($request->all(), ['weight', 'height'])) {
                return $error;
            }
            
            return ItToolsV1CalculatorUtil::calculateBMI((float)$weight, (float)$height, $unit);
        });
    }
    
    public function calculateLoanEMI(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $principal = $request->input('principal');
            $rate = $request->input('rate');
            $months = $request->input('months');
            
            if ($error = $this->validateRequired($request->all(), ['principal', 'rate', 'months'])) {
                return $error;
            }
            
            return ItToolsV1CalculatorUtil::calculateLoanEMI((float)$principal, (float)$rate, (int)$months);
        });
    }
    
    public function calculateGST(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $amount = $request->input('amount');
            $gstRate = $request->input('gst_rate');
            $operation = $request->input('operation', 'add');
            
            if ($error = $this->validateRequired($request->all(), ['amount', 'gst_rate'])) {
                return $error;
            }
            
            return ItToolsV1CalculatorUtil::calculateGST((float)$amount, (float)$gstRate, $operation);
        });
    }
    
    public function numberToWords(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $number = $request->input('number');
            
            if ($error = $this->validateRequired($request->all(), ['number'])) {
                return $error;
            }
            
            return [
                'number' => $number,
                'words' => ItToolsV1CalculatorUtil::numberToWords((int)$number)
            ];
        });
    }
}
