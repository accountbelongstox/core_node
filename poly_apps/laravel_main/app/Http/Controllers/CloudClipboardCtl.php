<?php

namespace App\Http\Controllers;

use App\Support\CloudClipboardContract as Contract;
use App\Traits\ApiResponse;
use App\Utils\CloudClipboardService;
use Illuminate\Http\Request;

final class CloudClipboardCtl extends Controller
{
    use ApiResponse;

    public function __construct(private CloudClipboardService $clipboard)
    {
    }

    public function data(Request $request)
    {
        $request->validate(['page' => 'sometimes|integer|min:1', 'since_revision' => 'sometimes|integer|min:0']);

        return $this->success($this->clipboard->snapshot($request), __('cloud_clipboard.success'))
            ->header('Cache-Control', 'no-store, private');
    }

    public function generate()
    {
        return $this->success(['namespace' => $this->clipboard->generate()], __('cloud_clipboard.success'));
    }

    public function authorizeHub(Request $request)
    {
        return $this->success($this->clipboard->hubAuthorization($request), __('cloud_clipboard.success'))
            ->header('Cache-Control', 'no-store, private');
    }

    public function mutate(Request $request, string $action)
    {
        $original = $request->isJson() ? json_decode($request->getContent(), true) : [];
        $rules = [
            'expected_revision' => 'required|integer|min:0',
            'entry_id' => 'required|uuid',
            'text' => 'present|nullable|string|max:'.Contract::get('max_text_length'),
            'new_password' => 'present|nullable|string|max:255',
            'expected_room_revision' => 'required|integer|min:0',
            'expected_current_entry_id' => 'required|uuid',
            'file_id' => 'required|uuid',
            'files' => 'required|array|min:1|max:'.Contract::get('max_files_per_upload'),
            'files.*' => 'required|file|max:'.Contract::get('max_file_kb'),
        ];
        $keys = ['expected_revision', 'entry_id'];

        if (is_array($original)) {
            $request->merge(array_intersect_key($original, array_flip(['text', 'new_password'])));
        }
        if ($action === 'text') $keys[] = 'text';
        if ($action === 'password') $keys = array_merge($keys, ['new_password', 'expected_room_revision']);
        if ($action === 'new' || $action === 'restore') $keys[] = 'expected_current_entry_id';
        if ($action === 'delete-file') $keys[] = 'file_id';
        if ($action === 'upload') $keys = array_merge($keys, ['files', 'files.*']);
        $request->validate(array_intersect_key($rules, array_flip($keys)));

        return $this->success($this->clipboard->mutate($request, $action), __('cloud_clipboard.success'))
            ->header('Cache-Control', 'no-store, private');
    }

    public function file(Request $request)
    {
        $request->validate(['entry_id' => 'required|uuid', 'file_id' => 'required|uuid']);
        $file = $this->clipboard->file($request);

        return response()->download($file['path'], $file['metadata']['original_name'], [
            'Content-Type' => 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'no-store, private',
        ]);
    }
}
