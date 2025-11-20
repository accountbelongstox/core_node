<?php

namespace App\Apps\BankV1\BankV1Controllers;

use App\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Apps\BankV1\BankV1Gvar\BankV1Config;
use App\Apps\BankV1\BankV1TablesMaps\BankV1TablesMaps;
use App\Apps\BankV1\BankV1Utils\BankV1SecurityUtils;
use App\Apps\BankV1\BankV1Utils\BankV1LoggingUtils;

class BankV1UserCtl extends Controller
{
    private $tableMaps;
    private $securityUtils;
    private $loggingUtils;
    
    public function __construct()
    {
        $this->tableMaps = new BankV1TablesMaps();
        $this->securityUtils = new BankV1SecurityUtils();
        $this->loggingUtils = new BankV1LoggingUtils();
    }

    public function getProfile(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            
            // Get user profile
            $usersTable = $this->tableMaps->getTableName('bank_users');
            $userProfile = DB::table($usersTable)
                ->where($this->tableMaps->getFieldName('bank_users', 'id'), $user->id)
                ->first();

            if (!$userProfile) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('USER_NOT_FOUND'),
                    404,
                    BankV1Config::getErrorCode('USER_NOT_FOUND')
                );
            }

            // Get account info
            $accountsTable = $this->tableMaps->getTableName('bank_accounts');
            $account = DB::table($accountsTable)
                ->where($this->tableMaps->getFieldName('bank_accounts', 'user_id'), $user->id)
                ->where($this->tableMaps->getFieldName('bank_accounts', 'status'), 'active')
                ->first();

            // Get address info
            $addressesTable = $this->tableMaps->getTableName('bank_user_addresses');
            $address = DB::table($addressesTable)
                ->where($this->tableMaps->getFieldName('bank_user_addresses', 'user_id'), $user->id)
                ->where($this->tableMaps->getFieldName('bank_user_addresses', 'is_primary'), true)
                ->first();

            $userData = [
                'id' => $userProfile->id,
                'username' => $userProfile->username,
                'email' => $userProfile->email,
                'full_name' => $userProfile->full_name,
                'phone' => $userProfile->phone,
                'date_of_birth' => $userProfile->date_of_birth,
                'gender' => $userProfile->gender,
                'balance' => $account ? BankV1Config::formatAmount((float)$account->balance) : 0.0,
                'account_number' => $account ? $account->account_number : null,
                'address' => $address ? [
                    'street' => $address->street,
                    'city' => $address->city,
                    'state' => $address->state,
                    'zip_code' => $address->zip_code,
                    'country' => $address->country,
                ] : null,
                'created_at' => $userProfile->created_at,
                'updated_at' => $userProfile->updated_at,
            ];

            return $this->successResponse($userData);

        } catch (\Exception $e) {
            Log::error('Get profile error: ' . $e->getMessage());
            return $this->errorResponse(
                BankV1Config::getErrorMessage('INTERNAL_ERROR'),
                500,
                'E999'
            );
        }
    }

    public function updateProfile(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            
            // Validate request
            $validator = Validator::make($request->all(), [
                'full_name' => 'nullable|string|max:' . BankV1Config::FULL_NAME_MAX_LENGTH,
                'email' => 'nullable|email|max:255|unique:' . $this->tableMaps->getTableName('bank_users') . ',' . $this->tableMaps->getFieldName('bank_users', 'email') . ',' . $user->id,
                'phone' => 'nullable|string|max:' . BankV1Config::PHONE_MAX_LENGTH,
                'date_of_birth' => 'nullable|date',
                'gender' => 'nullable|string|in:male,female,other',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('VALIDATION_ERROR'),
                    422,
                    BankV1Config::getErrorCode('VALIDATION_ERROR'),
                    $validator->errors()->toArray()
                );
            }

            $updateData = array_filter($validator->validated());
            
            if (empty($updateData)) {
                return $this->errorResponse('No data to update', 400);
            }

            $updateData[$this->tableMaps->getFieldName('bank_users', 'updated_at')] = now();

            // Update user profile
            $usersTable = $this->tableMaps->getTableName('bank_users');
            DB::table($usersTable)
                ->where($this->tableMaps->getFieldName('bank_users', 'id'), $user->id)
                ->update($updateData);

            // Log profile update
            $this->loggingUtils->logAppEvent(
                $user->id,
                $request->header('X-Device-ID'),
                null,
                BankV1Config::LOG_EVENT_TYPES['PROFILE_UPDATE'],
                [
                    'updated_fields' => array_keys($updateData),
                    'update_data' => $updateData,
                ],
                $request
            );

            // Get updated profile
            $updatedProfile = DB::table($usersTable)
                ->where($this->tableMaps->getFieldName('bank_users', 'id'), $user->id)
                ->first();

            return $this->successResponse(
                [
                    'id' => $updatedProfile->id,
                    'username' => $updatedProfile->username,
                    'email' => $updatedProfile->email,
                    'full_name' => $updatedProfile->full_name,
                    'phone' => $updatedProfile->phone,
                    'date_of_birth' => $updatedProfile->date_of_birth,
                    'gender' => $updatedProfile->gender,
                    'updated_at' => $updatedProfile->updated_at,
                ],
                BankV1Config::getSuccessMessage('PROFILE_UPDATED')
            );

        } catch (\Exception $e) {
            Log::error('Update profile error: ' . $e->getMessage());
            return $this->errorResponse(
                BankV1Config::getErrorMessage('INTERNAL_ERROR'),
                500,
                'E999'
            );
        }
    }

    public function updateBalance(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            
            // Validate request
            $validator = Validator::make($request->all(), [
                'new_balance' => 'required|numeric|min:' . BankV1Config::MIN_ACCOUNT_BALANCE,
                'reason' => 'nullable|string|max:255',
                'transaction_type' => 'nullable|string|in:' . implode(',', array_values(BankV1Config::TRANSACTION_TYPES)),
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('VALIDATION_ERROR'),
                    422,
                    BankV1Config::getErrorCode('VALIDATION_ERROR'),
                    $validator->errors()->toArray()
                );
            }

            $data = $validator->validated();
            $newBalance = BankV1Config::formatAmount($data['new_balance']);
            $reason = $data['reason'] ?? 'Manual balance update';
            $transactionType = $data['transaction_type'] ?? BankV1Config::TRANSACTION_TYPES['ADJUSTMENT'];

            // Get current account
            $accountsTable = $this->tableMaps->getTableName('bank_accounts');
            $account = DB::table($accountsTable)
                ->where($this->tableMaps->getFieldName('bank_accounts', 'user_id'), $user->id)
                ->where($this->tableMaps->getFieldName('bank_accounts', 'status'), 'active')
                ->first();

            if (!$account) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('ACCOUNT_NOT_FOUND'),
                    404,
                    BankV1Config::getErrorCode('ACCOUNT_NOT_FOUND')
                );
            }

            $oldBalance = (float)$account->balance;
            $balanceDifference = $newBalance - $oldBalance;

            DB::beginTransaction();

            try {
                // Update account balance
                DB::table($accountsTable)
                    ->where($this->tableMaps->getFieldName('bank_accounts', 'id'), $account->id)
                    ->update([
                        $this->tableMaps->getFieldName('bank_accounts', 'balance') => $newBalance,
                        $this->tableMaps->getFieldName('bank_accounts', 'updated_at') => now(),
                    ]);

                // Create transaction record
                $transactionsTable = $this->tableMaps->getTableName('bank_transactions');
                $transactionId = 'TXN' . uniqid() . time();
                
                DB::table($transactionsTable)->insert([
                    $this->tableMaps->getFieldName('bank_transactions', 'transaction_id') => $transactionId,
                    $this->tableMaps->getFieldName('bank_transactions', 'from_account_id') => $account->id,
                    $this->tableMaps->getFieldName('bank_transactions', 'to_account_id') => $account->id,
                    $this->tableMaps->getFieldName('bank_transactions', 'amount') => abs($balanceDifference),
                    $this->tableMaps->getFieldName('bank_transactions', 'fee') => 0,
                    $this->tableMaps->getFieldName('bank_transactions', 'currency') => BankV1Config::ACCOUNT_CURRENCY,
                    $this->tableMaps->getFieldName('bank_transactions', 'type') => $transactionType,
                    $this->tableMaps->getFieldName('bank_transactions', 'status') => BankV1Config::TRANSACTION_STATUS['COMPLETED'],
                    $this->tableMaps->getFieldName('bank_transactions', 'description') => $reason,
                    $this->tableMaps->getFieldName('bank_transactions', 'metadata') => json_encode([
                        'old_balance' => $oldBalance,
                        'new_balance' => $newBalance,
                        'balance_change' => $balanceDifference,
                        'updated_by' => 'user',
                        'update_method' => 'mobile_app',
                    ]),
                    $this->tableMaps->getFieldName('bank_transactions', 'processed_at') => now(),
                    $this->tableMaps->getFieldName('bank_transactions', 'created_at') => now(),
                    $this->tableMaps->getFieldName('bank_transactions', 'updated_at') => now(),
                ]);

                DB::commit();

                // Log balance update
                $this->loggingUtils->logAppEvent(
                    $user->id,
                    $request->header('X-Device-ID'),
                    null,
                    BankV1Config::LOG_EVENT_TYPES['BALANCE_UPDATE'],
                    [
                        'old_balance' => $oldBalance,
                        'new_balance' => $newBalance,
                        'balance_change' => $balanceDifference,
                        'reason' => $reason,
                        'transaction_id' => $transactionId,
                    ],
                    $request
                );

                return $this->successResponse(
                    [
                        'old_balance' => $oldBalance,
                        'new_balance' => $newBalance,
                        'balance_change' => $balanceDifference,
                        'transaction_id' => $transactionId,
                        'updated_at' => now()->toISOString(),
                    ],
                    BankV1Config::getSuccessMessage('BALANCE_UPDATED')
                );

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Update balance error: ' . $e->getMessage());
            return $this->errorResponse(
                BankV1Config::getErrorMessage('INTERNAL_ERROR'),
                500,
                'E999'
            );
        }
    }

    public function updateAddress(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            
            // Validate request
            $validator = Validator::make($request->all(), [
                'street' => 'nullable|string|max:' . BankV1Config::ADDRESS_MAX_LENGTH,
                'city' => 'nullable|string|max:100',
                'state' => 'nullable|string|max:100',
                'zip_code' => 'nullable|string|max:20',
                'country' => 'nullable|string|max:100',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('VALIDATION_ERROR'),
                    422,
                    BankV1Config::getErrorCode('VALIDATION_ERROR'),
                    $validator->errors()->toArray()
                );
            }

            $addressData = array_filter($validator->validated());
            
            if (empty($addressData)) {
                return $this->errorResponse('No address data to update', 400);
            }

            $addressesTable = $this->tableMaps->getTableName('bank_user_addresses');
            
            // Check if user has existing address
            $existingAddress = DB::table($addressesTable)
                ->where($this->tableMaps->getFieldName('bank_user_addresses', 'user_id'), $user->id)
                ->where($this->tableMaps->getFieldName('bank_user_addresses', 'is_primary'), true)
                ->first();

            $addressData[$this->tableMaps->getFieldName('bank_user_addresses', 'updated_at')] = now();

            if ($existingAddress) {
                // Update existing address
                DB::table($addressesTable)
                    ->where($this->tableMaps->getFieldName('bank_user_addresses', 'id'), $existingAddress->id)
                    ->update($addressData);
                
                $addressId = $existingAddress->id;
            } else {
                // Create new address
                $addressData[$this->tableMaps->getFieldName('bank_user_addresses', 'user_id')] = $user->id;
                $addressData[$this->tableMaps->getFieldName('bank_user_addresses', 'type')] = 'primary';
                $addressData[$this->tableMaps->getFieldName('bank_user_addresses', 'is_primary')] = true;
                $addressData[$this->tableMaps->getFieldName('bank_user_addresses', 'created_at')] = now();
                
                $addressId = DB::table($addressesTable)->insertGetId($addressData);
            }

            // Log address update
            $this->loggingUtils->logAppEvent(
                $user->id,
                $request->header('X-Device-ID'),
                null,
                BankV1Config::LOG_EVENT_TYPES['ADDRESS_UPDATE'],
                [
                    'address_id' => $addressId,
                    'updated_fields' => array_keys($addressData),
                    'action' => $existingAddress ? 'update' : 'create',
                ],
                $request
            );

            // Get updated address
            $updatedAddress = DB::table($addressesTable)
                ->where($this->tableMaps->getFieldName('bank_user_addresses', 'id'), $addressId)
                ->first();

            return $this->successResponse(
                [
                    'id' => $updatedAddress->id,
                    'street' => $updatedAddress->street,
                    'city' => $updatedAddress->city,
                    'state' => $updatedAddress->state,
                    'zip_code' => $updatedAddress->zip_code,
                    'country' => $updatedAddress->country,
                    'updated_at' => $updatedAddress->updated_at,
                ],
                BankV1Config::getSuccessMessage('ADDRESS_UPDATED')
            );

        } catch (\Exception $e) {
            Log::error('Update address error: ' . $e->getMessage());
            return $this->errorResponse(
                BankV1Config::getErrorMessage('INTERNAL_ERROR'),
                500,
                'E999'
            );
        }
    }

    public function registerWithCode(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            
            // Validate request
            $validator = Validator::make($request->all(), [
                'registration_code' => 'required|string|max:50',
                'referral_source' => 'nullable|string|max:100',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('VALIDATION_ERROR'),
                    422,
                    BankV1Config::getErrorCode('VALIDATION_ERROR'),
                    $validator->errors()->toArray()
                );
            }

            $data = $validator->validated();
            $registrationCode = $data['registration_code'];
            $referralSource = $data['referral_source'] ?? null;

            // Check if code exists and is valid
            $codesTable = $this->tableMaps->getTableName('bank_registration_codes');
            $code = DB::table($codesTable)
                ->where($this->tableMaps->getFieldName('bank_registration_codes', 'code'), $registrationCode)
                ->where($this->tableMaps->getFieldName('bank_registration_codes', 'is_active'), true)
                ->where(function($query) {
                    $query->whereNull($this->tableMaps->getFieldName('bank_registration_codes', 'expires_at'))
                          ->orWhere($this->tableMaps->getFieldName('bank_registration_codes', 'expires_at'), '>', now());
                })
                ->first();

            if (!$code) {
                return $this->errorResponse(
                    BankV1Config::getErrorMessage('INVALID_REGISTRATION_CODE'),
                    400,
                    BankV1Config::getErrorCode('INVALID_REGISTRATION_CODE')
                );
            }

            // Check if code has remaining uses
            if ($code->max_uses && $code->used_count >= $code->max_uses) {
                return $this->errorResponse(
                    'Registration code has been fully used',
                    400,
                    BankV1Config::getErrorCode('INVALID_REGISTRATION_CODE')
                );
            }

            // Check if user has already used this code
            $usageTable = $this->tableMaps->getTableName('bank_code_usage');
            $existingUsage = DB::table($usageTable)
                ->where($this->tableMaps->getFieldName('bank_code_usage', 'code_id'), $code->id)
                ->where($this->tableMaps->getFieldName('bank_code_usage', 'user_id'), $user->id)
                ->exists();

            if ($existingUsage) {
                return $this->errorResponse(
                    'Registration code has already been used by this user',
                    400,
                    BankV1Config::getErrorCode('INVALID_REGISTRATION_CODE')
                );
            }

            DB::beginTransaction();

            try {
                // Record code usage
                DB::table($usageTable)->insert([
                    $this->tableMaps->getFieldName('bank_code_usage', 'code_id') => $code->id,
                    $this->tableMaps->getFieldName('bank_code_usage', 'user_id') => $user->id,
                    $this->tableMaps->getFieldName('bank_code_usage', 'device_id') => $request->header('X-Device-ID'),
                    $this->tableMaps->getFieldName('bank_code_usage', 'used_at') => now(),
                    $this->tableMaps->getFieldName('bank_code_usage', 'ip_address') => $request->ip(),
                    $this->tableMaps->getFieldName('bank_code_usage', 'user_agent') => $request->userAgent(),
                    $this->tableMaps->getFieldName('bank_code_usage', 'created_at') => now(),
                ]);

                // Update code usage count
                DB::table($codesTable)
                    ->where($this->tableMaps->getFieldName('bank_registration_codes', 'id'), $code->id)
                    ->increment($this->tableMaps->getFieldName('bank_registration_codes', 'used_count'));

                // Apply code benefits (e.g., add balance)
                $benefits = [];
                if ($code->type === 'balance_bonus' && $code->value > 0) {
                    $accountsTable = $this->tableMaps->getTableName('bank_accounts');
                    DB::table($accountsTable)
                        ->where($this->tableMaps->getFieldName('bank_accounts', 'user_id'), $user->id)
                        ->where($this->tableMaps->getFieldName('bank_accounts', 'status'), 'active')
                        ->increment($this->tableMaps->getFieldName('bank_accounts', 'balance'), $code->value);
                    
                    $benefits[] = [
                        'type' => 'balance_bonus',
                        'amount' => $code->value,
                        'description' => 'Registration code bonus',
                    ];
                }

                DB::commit();

                // Log code registration
                $this->loggingUtils->logAppEvent(
                    $user->id,
                    $request->header('X-Device-ID'),
                    null,
                    BankV1Config::LOG_EVENT_TYPES['CODE_REGISTRATION'],
                    [
                        'code' => $registrationCode,
                        'code_type' => $code->type,
                        'code_value' => $code->value,
                        'benefits' => $benefits,
                        'referral_source' => $referralSource,
                    ],
                    $request
                );

                return $this->successResponse(
                    [
                        'code_valid' => true,
                        'code_type' => $code->type,
                        'benefits' => $benefits,
                        'applied_at' => now()->toISOString(),
                    ],
                    BankV1Config::getSuccessMessage('CODE_APPLIED')
                );

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Register with code error: ' . $e->getMessage());
            return $this->errorResponse(
                BankV1Config::getErrorMessage('INTERNAL_ERROR'),
                500,
                'E999'
            );
        }
    }

    private function successResponse(array $data, string $message = 'Success'): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
            'message' => $message,
            'timestamp' => now()->toISOString(),
        ]);
    }

    private function errorResponse(string $message, int $statusCode = 400, string $errorCode = null, array $errors = []): JsonResponse
    {
        $response = [
            'success' => false,
            'error' => $message,
            'message' => $message,
            'timestamp' => now()->toISOString(),
        ];

        if ($errorCode) {
            $response['error_code'] = $errorCode;
        }

        if (!empty($errors)) {
            $response['errors'] = $errors;
        }

        return response()->json($response, $statusCode);
    }
}
