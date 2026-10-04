<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1PhraseAudioService;
use App\Http\Controllers\Controller;
use App\Services\WorkLeases\WorkLeaseLanes;
use App\Support\QueueCenterContract;
use App\Traits\ApiResponse;
use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

/**
 * Phrase audio surface (lane phrase_audio, docs_fix/DESIGN_PHRASE_PIPELINE.md §5):
 *   POST /api/app_qy_v1/ai_tools/tts/phrase/report  (audio_phrase_report, client key)
 *   GET  /api/app_qy_v1/ai_tools/tts/phrase/audio   (audio_phrase_audio, file-first resolve)
 */
class AppQyV1PhraseAudioCtl extends Controller
{
    use ApiResponse;

    private const ERROR_VALIDATION_FAILED = 'PHRASE_AUDIO_VALIDATION_FAILED';
    private const ERROR_INVALID_PAYLOAD = 'PHRASE_AUDIO_INVALID_PAYLOAD';
    private const ERROR_NOT_FOUND = 'PHRASE_AUDIO_NOT_FOUND';
    private const CONTENT_ID_RULE = 'regex:/^[a-f0-9]{32}$/i';
    private const CACHE_CONTROL = 'public, max-age=31536000';
    private const AUDIO_MIME = 'audio/mpeg';

    public function __construct(private readonly AppQyV1PhraseAudioService $service = new AppQyV1PhraseAudioService())
    {
    }

    /**
     * Multipart (success): { content_id, language, worker_id?, success?:"true", text?, provider?, audio|file:<mp3> }
     * (or audio_base64). Failure: { content_id, language, worker_id?, success:"false", error? }.
     */
    public function report(Request $request): JsonResponse
    {
        $audioBinary = null;
        $upload = null;
        $result = [];
        $status = 0;
        $validator = Validator::make($request->all(), [
            'content_id' => ['required', 'string', self::CONTENT_ID_RULE],
            'language' => 'required|string|max:20',
            'text' => 'nullable|string|max:' . $this->textMaxChars(),
            'worker_id' => 'nullable|string|max:100',
            'success' => 'nullable',
            'provider' => 'nullable|string|max:100',
            'error' => 'nullable|string|max:2000',
            'audio_base64' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->validationFailed($validator);
        }
        $success = !$request->has('success') || filter_var($request->input('success'), FILTER_VALIDATE_BOOLEAN);
        if ($success) {
            $upload = $request->file('audio') ?? $request->file('file');
            if ($upload !== null) {
                if (!$upload->isValid()) {
                    return $this->codedError(self::ERROR_INVALID_PAYLOAD, __('app_qy_v1.messages.phrase_audio_upload_failed', ['detail' => $upload->getErrorMessage()]), [], 422);
                }
                $audioBinary = (string) $upload->get();
            } elseif ($request->filled('audio_base64')) {
                $audioBinary = base64_decode((string) $request->input('audio_base64'), true);
                if ($audioBinary === false) {
                    return $this->codedError(self::ERROR_INVALID_PAYLOAD, __('app_qy_v1.messages.phrase_audio_base64_invalid'), [], 422);
                }
            }
        }

        $result = $this->service->report(
            (string) $request->input('content_id'),
            (string) $request->input('language'),
            (string) $request->input('worker_id', ''),
            $success,
            $audioBinary,
            $request->input('provider'),
            $request->input('error'),
            $request->input('text')
        );
        $status = $result['http_status'];
        unset($result['http_status']);

        return response()->json(['success' => $result['ok']] + $result, $status);
    }

    /**
     * Query: text|content_id, language, passive? (no promotion), stream? (the MP3 itself).
     * Present → 200 with url (or the file); absent → 404 (promoted to the lane head unless passive).
     */
    public function audio(Request $request): JsonResponse|Response
    {
        $result = [];
        $validator = Validator::make($request->all(), [
            'text' => 'required_without:content_id|nullable|string|max:' . $this->textMaxChars(),
            'content_id' => ['required_without:text', 'nullable', 'string', self::CONTENT_ID_RULE],
            'language' => 'required|string|max:20',
            'passive' => 'nullable|boolean',
            'stream' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->validationFailed($validator);
        }
        $result = $this->service->resolve(
            $request->query('content_id'),
            $request->query('text'),
            (string) $request->query('language'),
            $request->boolean('passive')
        );
        // An unknown language carries no queued flag (422); a known phrase without a clip is 404.
        if (!$result['exists']) {
            return $this->codedError(self::ERROR_NOT_FOUND, (string) $result['error'], array_diff_key($result, ['error' => true]), array_key_exists('queued', $result) ? 404 : 422);
        }
        if ($request->boolean('stream')) {
            return response()->file((string) $result['path'], ['Content-Type' => self::AUDIO_MIME, 'Cache-Control' => self::CACHE_CONTROL]);
        }
        unset($result['path']);

        return response()->json($result);
    }

    private function textMaxChars(): int
    {
        return (int) (QueueCenterContract::taskTypeDefinition(WorkLeaseLanes::PHRASE_AUDIO)['payload_limits']['text_max_chars'] ?? 200);
    }

    private function validationFailed(ValidatorContract $validator): JsonResponse
    {
        return $this->codedError(
            self::ERROR_VALIDATION_FAILED,
            __('app_qy_v1.messages.phrase_audio_validation_failed', ['detail' => $validator->errors()->first()]),
            ['errors' => $validator->errors()->toArray()],
            422
        );
    }
}
