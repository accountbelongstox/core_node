<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Mcp\Tools;

use Illuminate\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tool;
use App\Apps\McpV1\McpV1Utils\McpV1ImageProcessor;
use App\Apps\McpV1\McpV1Gvar\McpV1Config;

class McpV1ImageManipulationTool extends Tool
{
    /**
     * The tool's description.
     */
    protected string $description = 'Manipulate images: resize, crop, convert format, adjust quality, and apply filters. Supports JPEG, PNG, GIF, and WebP formats.';

    /**
     * Handle the tool request.
     */
    public function handle(Request $request): Response
    {
        $validated = $request->validate([
            'image_path' => 'required|string',
            'operation' => 'required|string|in:resize,crop,convert,quality,rotate,flip',
            'output_path' => 'nullable|string',
            'width' => 'nullable|integer|min:1',
            'height' => 'nullable|integer|min:1',
            'format' => 'nullable|string|in:jpeg,jpg,png,gif,webp',
            'quality' => 'nullable|integer|min:1|max:100',
            'x' => 'nullable|integer|min:0',
            'y' => 'nullable|integer|min:0',
            'angle' => 'nullable|integer|min:-360|max:360',
            'direction' => 'nullable|string|in:horizontal,vertical',
        ]);

        $imagePath = $validated['image_path'];
        $operation = $validated['operation'];
        $outputPath = $validated['output_path'] ?? null;

        $processor = new McpV1ImageProcessor();

        if (!$processor->validateOperation($operation)) {
            return Response::text("Error: Invalid operation. Supported operations: " . implode(', ', McpV1Config::SUPPORTED_OPERATIONS));
        }

        if (isset($validated['format']) && !$processor->validateFormat($validated['format'])) {
            return Response::text("Error: Invalid format. Supported formats: " . implode(', ', McpV1Config::SUPPORTED_IMAGE_FORMATS));
        }

        $params = [
            'width' => $validated['width'] ?? null,
            'height' => $validated['height'] ?? null,
            'format' => $validated['format'] ?? null,
            'quality' => $validated['quality'] ?? null,
            'x' => $validated['x'] ?? null,
            'y' => $validated['y'] ?? null,
            'angle' => $validated['angle'] ?? null,
            'direction' => $validated['direction'] ?? null,
        ];

        $result = $processor->processImage($imagePath, $operation, $params, $outputPath);

        if ($result['success']) {
            return Response::text($result['message']);
        } else {
            return Response::text($result['message']);
        }
    }

    /**
     * Get the tool's input schema.
     *
     * @return array<string, \Illuminate\JsonSchema\JsonSchema>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'image_path' => $schema->string()
                ->description('Path to the input image file')
                ->required(),

            'operation' => $schema->string()
                ->enum(['resize', 'crop', 'convert', 'quality', 'rotate', 'flip'])
                ->description('The image manipulation operation to perform')
                ->required(),

            'output_path' => $schema->string()
                ->description('Path where the processed image will be saved. If not provided, overwrites the original.'),

            'width' => $schema->integer()
                ->description('Target width in pixels (for resize/crop operations)'),

            'height' => $schema->integer()
                ->description('Target height in pixels (for resize/crop operations)'),

            'format' => $schema->string()
                ->enum(['jpeg', 'jpg', 'png', 'gif', 'webp'])
                ->description('Output image format (for convert operation)'),

            'quality' => $schema->integer()
                ->description('Image quality (1-100, for JPEG/WebP)')
                ->default(90),

            'x' => $schema->integer()
                ->description('X coordinate for crop operation (default: 0)')
                ->default(0),

            'y' => $schema->integer()
                ->description('Y coordinate for crop operation (default: 0)')
                ->default(0),

            'angle' => $schema->integer()
                ->description('Rotation angle in degrees (-360 to 360, for rotate operation)'),

            'direction' => $schema->string()
                ->enum(['horizontal', 'vertical'])
                ->description('Flip direction (for flip operation)')
                ->default('horizontal'),
        ];
    }
}
