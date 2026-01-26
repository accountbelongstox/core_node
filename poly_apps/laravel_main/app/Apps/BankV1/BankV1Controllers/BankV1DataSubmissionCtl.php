<?php

namespace App\Apps\BankV1\BankV1Controllers;

use App\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Traits\ApiResponse;
use App\Apps\BankV1\BankV1Services\BankV1DataSubmissionService;
use App\Apps\BankV1\BankV1Services\BankV1DataQueryService;

class BankV1DataSubmissionCtl extends Controller
{
    use ApiResponse;

    private $submissionService;
    private $queryService;

    public function __construct()
    {
        $this->submissionService = new BankV1DataSubmissionService();
        $this->queryService = new BankV1DataQueryService();
    }

    public function submitData(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'device_info' => 'required|array',
            'device_info.device_name' => 'required|string|max:255',
            'device_info.device_id' => 'required|string|max:255',
            'device_info.app_signature' => 'required|string|max:255',
            'device_info.machine_code' => 'required|string|max:16',
            'device_info.platform' => 'required|string|max:50',
            'device_info.platform_version' => 'required|string|max:50',
            'device_info.ip_address' => 'nullable|ip',
            'device_info.additional_info' => 'nullable|array',
            'registration_info' => 'required|array',
            'registration_info.registration_code' => 'nullable|string|max:255',
            'registration_info.is_registered' => 'required|boolean',
            'registration_info.is_super_user' => 'required|boolean',
            'registration_info.registration_time' => 'nullable|date',
            'registration_info.expiration_time' => 'nullable|date',
            'user_data' => 'required|array',
            'user_data.phone' => 'nullable|string|max:20',
            'user_data.full_name' => 'nullable|string|max:255',
            'user_data.location' => 'nullable|string|max:255',
            'user_data.city' => 'nullable|string|max:255',
            'user_data.total_balance' => 'nullable|numeric',
            'user_data.cards' => 'required|array',
            'user_data.cards.*.card_number' => 'required|string|max:50',
            'user_data.cards.*.card_type' => 'required|string|max:50',
            'user_data.cards.*.balance' => 'required|numeric',
            'user_data.cards.*.currency' => 'required|string|max:3',
            'user_data.cards.*.opened_at' => 'nullable|date',
            'user_data.additional_data' => 'nullable|array',
            'submit_time' => 'required|date',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors(), 'Validation failed');
        }

        $data = $validator->validated();
        $deviceInfo = $data['device_info'];
        $registrationInfo = $data['registration_info'];
        $userData = $data['user_data'];
        $submitTime = $data['submit_time'];

        DB::beginTransaction();

        try {
            $deviceSubmissionId = $this->submissionService->saveDeviceSubmission($deviceInfo, $request->ip());
            $registrationSubmissionId = $this->submissionService->saveRegistrationSubmission($deviceSubmissionId, $registrationInfo);
            $userDataSubmissionId = $this->submissionService->saveUserDataSubmission($deviceSubmissionId, $userData, $submitTime);
            $this->submissionService->saveBankCards($userDataSubmissionId, $userData['cards'] ?? []);

            DB::commit();

            $submissionId = 'sub_' . str_replace(['-', ':', ' '], '', $submitTime) . '_' . $deviceSubmissionId;

            Log::info('BankV1 data submission successful', [
                'device_id' => $deviceInfo['device_id'],
                'submission_id' => $submissionId,
            ]);

            return $this->success([
                'submission_id' => $submissionId,
                'received_at' => now()->toISOString(),
            ], 'Data submitted successfully');

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('BankV1 data submission failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->error('Data submission failed: ' . $e->getMessage(), 500);
        }
    }

    public function getStats(Request $request): JsonResponse
    {
        try {
            $stats = $this->queryService->getStats();
            return $this->success($stats, 'Statistics retrieved successfully');
        } catch (\Exception $e) {
            Log::error('BankV1 getStats failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to retrieve statistics: ' . $e->getMessage(), 500);
        }
    }

    public function getSubmissions(Request $request): JsonResponse
    {
        try {
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 20);
            
            $filters = [
                'device_id' => $request->input('device_id'),
                'start_date' => $request->input('start_date'),
                'end_date' => $request->input('end_date'),
            ];

            $result = $this->queryService->getSubmissions($filters, $page, $perPage);
            return $this->success($result, 'Submissions retrieved successfully');
        } catch (\Exception $e) {
            Log::error('BankV1 getSubmissions failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to retrieve submissions: ' . $e->getMessage(), 500);
        }
    }
}

