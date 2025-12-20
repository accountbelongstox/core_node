<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller as BaseController;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1CoverImageService;
use Illuminate\Support\Facades\Log;

class AppQyV1CoverImageController extends BaseController
{
    /**
     * Serve cover image file
     */
    public function serveCoverImage(string $filename): Response
    {
        $path = AppQyV1CoverImageService::getImagePath($filename);

        if (!$path || !file_exists($path)) {
            Log::warning('[AppQyV1CoverImage] Image not found', ['filename' => $filename]);
            abort(404, 'Image not found');
        }

        $mimeType = 'image/png';
        $content = file_get_contents($path);

        return response($content, 200)
            ->header('Content-Type', $mimeType)
            ->header('Cache-Control', 'public, max-age=2592000'); // Cache for 30 days
    }

    /**
     * Get category information
     */
    public function getCategories(): Response
    {
        $categories = AppQyV1CoverImageService::getCategories();

        $categoriesData = [];
        foreach ($categories as $category) {
            $config = AppQyV1CoverImageService::getCategoryConfig($category);
            $categoriesData[] = [
                'key' => $category,
                'name' => $config['name'],
                'emoji' => $config['emoji'],
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $categoriesData,
        ]);
    }
}
