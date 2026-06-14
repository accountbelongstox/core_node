<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\ItToolsV1\ItToolsV1Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Apps\ItToolsV1\ItToolsV1Utils\ItToolsV1ImageUtil;
use App\Apps\ItToolsV1\ItToolsV1Utils\ItToolsV1CalculatorUtil;
use App\Apps\ItToolsV1\ItToolsV1Utils\ItToolsV1PdfUtil;

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
    
    public function imageCompress(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $file = $request->file('image');
            $quality = $request->input('quality', 85);
            $format = $request->input('format');
            
            if (!$file) {
                return $this->error('Image file required', null, 422);
            }
            
            $tempPath = $file->store('temp');
            $fullPath = storage_path('app/' . $tempPath);
            
            $result = ItToolsV1ImageUtil::compressImage($fullPath, (int)$quality, $format);
            
            $base64 = base64_encode(file_get_contents($result['path']));
            
            unlink($fullPath);
            unlink($result['path']);
            
            return [
                'image_data' => 'data:image/' . $result['format'] . ';base64,' . $base64,
                'format' => $result['format'],
                'quality' => $result['quality'],
                'original_size' => $result['original_size'],
                'compressed_size' => $result['compressed_size'],
                'compression_ratio' => $result['compression_ratio'] . '%',
                'original_size_readable' => ItToolsV1ImageUtil::formatBytes($result['original_size']),
                'compressed_size_readable' => ItToolsV1ImageUtil::formatBytes($result['compressed_size'])
            ];
        });
    }
    
    public function imageCrop(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $file = $request->file('image');
            $x = $request->input('x', 0);
            $y = $request->input('y', 0);
            $width = $request->input('width');
            $height = $request->input('height');
            
            if (!$file || !$width || !$height) {
                return $this->error('Image file, width and height required', null, 422);
            }
            
            $tempPath = $file->store('temp');
            $fullPath = storage_path('app/' . $tempPath);
            
            $result = ItToolsV1ImageUtil::cropImage($fullPath, (int)$x, (int)$y, (int)$width, (int)$height);
            
            $base64 = base64_encode(file_get_contents($result['path']));
            
            unlink($fullPath);
            unlink($result['path']);
            
            return [
                'image_data' => 'data:image/png;base64,' . $base64,
                'crop_area' => $result['crop_area'],
                'file_size' => $result['file_size']
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
    
    public function pdfSplit(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $file = $request->file('pdf');
            $ranges = $request->input('ranges');
            
            if (!$file) {
                return $this->error('PDF file required', null, 422);
            }
            
            if (!$ranges) {
                return $this->error('Page ranges required', null, 422);
            }
            
            $tempPath = $file->store('temp');
            $fullPath = storage_path('app/' . $tempPath);
            
            $pageRanges = json_decode($ranges, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $pageRanges = explode(',', $ranges);
            }
            
            $results = ItToolsV1PdfUtil::splitPdf($fullPath, $pageRanges);
            
            $outputFiles = [];
            foreach ($results as $result) {
                $base64 = base64_encode(file_get_contents($result['path']));
                $outputFiles[] = [
                    'data' => 'data:application/pdf;base64,' . $base64,
                    'pages' => $result['pages'],
                    'file_size' => $result['file_size'],
                    'file_size_readable' => ItToolsV1PdfUtil::formatBytes($result['file_size']),
                    'index' => $result['index']
                ];
                unlink($result['path']);
            }
            
            unlink($fullPath);
            
            return [
                'files' => $outputFiles,
                'count' => count($outputFiles)
            ];
        });
    }
    
    public function pdfMerge(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $files = $request->file('pdfs');
            
            if (!$files || !is_array($files)) {
                return $this->error('Multiple PDF files required', null, 422);
            }
            
            $tempPaths = [];
            foreach ($files as $file) {
                $tempPath = $file->store('temp');
                $tempPaths[] = storage_path('app/' . $tempPath);
            }
            
            $result = ItToolsV1PdfUtil::mergePdfs($tempPaths);
            
            $base64 = base64_encode(file_get_contents($result['path']));
            
            foreach ($tempPaths as $path) {
                unlink($path);
            }
            unlink($result['path']);
            
            return [
                'data' => 'data:application/pdf;base64,' . $base64,
                'file_size' => $result['file_size'],
                'file_size_readable' => ItToolsV1PdfUtil::formatBytes($result['file_size']),
                'page_count' => $result['page_count'],
                'input_count' => $result['input_count']
            ];
        });
    }
    
    public function pdfCompress(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $file = $request->file('pdf');
            $quality = $request->input('quality', 'screen');
            
            if (!$file) {
                return $this->error('PDF file required', null, 422);
            }
            
            $tempPath = $file->store('temp');
            $fullPath = storage_path('app/' . $tempPath);
            
            $result = ItToolsV1PdfUtil::compressPdf($fullPath, $quality);
            
            $base64 = base64_encode(file_get_contents($result['path']));
            
            unlink($fullPath);
            unlink($result['path']);
            
            return [
                'data' => 'data:application/pdf;base64,' . $base64,
                'original_size' => $result['original_size'],
                'compressed_size' => $result['compressed_size'],
                'original_size_readable' => ItToolsV1PdfUtil::formatBytes($result['original_size']),
                'compressed_size_readable' => ItToolsV1PdfUtil::formatBytes($result['compressed_size']),
                'compression_ratio' => $result['compression_ratio'] . '%',
                'quality' => $result['quality']
            ];
        });
    }
    
    public function pdfRotate(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $file = $request->file('pdf');
            $rotation = $request->input('rotation', 90);
            $pages = $request->input('pages');
            
            if (!$file) {
                return $this->error('PDF file required', null, 422);
            }
            
            $tempPath = $file->store('temp');
            $fullPath = storage_path('app/' . $tempPath);
            
            $pageArray = $pages ? json_decode($pages, true) : null;
            
            $result = ItToolsV1PdfUtil::rotatePdf($fullPath, (int)$rotation, $pageArray);
            
            $base64 = base64_encode(file_get_contents($result['path']));
            
            unlink($fullPath);
            unlink($result['path']);
            
            return [
                'data' => 'data:application/pdf;base64,' . $base64,
                'rotation' => $result['rotation'],
                'pages' => $result['pages'],
                'file_size' => $result['file_size'],
                'file_size_readable' => ItToolsV1PdfUtil::formatBytes($result['file_size'])
            ];
        });
    }
    
    public function pdfAddPassword(Request $request): JsonResponse
    {
        return $this->safeExecute(function() use ($request) {
            $file = $request->file('pdf');
            $password = $request->input('password');
            
            if (!$file || !$password) {
                return $this->error('PDF file and password required', null, 422);
            }
            
            $tempPath = $file->store('temp');
            $fullPath = storage_path('app/' . $tempPath);
            
            $result = ItToolsV1PdfUtil::addPasswordToPdf($fullPath, $password);
            
            $base64 = base64_encode(file_get_contents($result['path']));
            
            unlink($fullPath);
            unlink($result['path']);
            
            return [
                'data' => 'data:application/pdf;base64,' . $base64,
                'protected' => $result['protected'],
                'file_size' => $result['file_size'],
                'file_size_readable' => ItToolsV1PdfUtil::formatBytes($result['file_size'])
            ];
        });
    }
}
