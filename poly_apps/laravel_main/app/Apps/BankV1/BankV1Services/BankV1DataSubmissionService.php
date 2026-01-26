<?php

namespace App\Apps\BankV1\BankV1Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Crypt;
use Carbon\Carbon;
use App\Apps\BankV1\BankV1TablesMaps\BankV1TablesMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class BankV1DataSubmissionService
{
    private $tableMaps;
    private $connection;

    public function __construct()
    {
        $this->tableMaps = new BankV1TablesMaps();
        $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::BANKV1);
        $this->connection = DB::connection($connectionName);
    }

    public function saveDeviceSubmission(array $deviceInfo, string $ipAddress): array
    {
        try {
            $tableName = $this->tableMaps->getTableName('device_submissions');

            // Validate required fields
            if (empty($deviceInfo['device_id'])) {
                Log::error('BankV1: Device ID is required', [
                    'device_info' => $deviceInfo,
                ]);
                return [
                    'success' => false,
                    'error' => 'Device ID is required',
                    'id' => null,
                ];
            }

            $deviceId = $deviceInfo['device_id'];
            
            // Retry logic for database connection
            $maxRetries = 3;
            $retryCount = 0;
            $existing = null;
            
            while ($retryCount < $maxRetries) {
                try {
                    $existing = $this->connection->table($tableName)
                        ->where('device_id', $deviceId)
                        ->first();
                    break;
                } catch (\Illuminate\Database\QueryException $e) {
                    $retryCount++;
                    if ($retryCount >= $maxRetries) {
                        Log::error('BankV1: Failed to query device submission after retries', [
                            'device_id' => $deviceId,
                            'error' => $e->getMessage(),
                            'retries' => $maxRetries,
                        ]);
                        return [
                            'success' => false,
                            'error' => 'Database connection failed after retries',
                            'id' => null,
                        ];
                    }
                    usleep(100000); // Wait 100ms before retry
                }
            }

            // Safely encode additional_info
            $additionalInfo = [];
            try {
                if (!empty($deviceInfo['additional_info'])) {
                    if (is_string($deviceInfo['additional_info'])) {
                        $additionalInfo = json_decode($deviceInfo['additional_info'], true) ?? [];
                    } else {
                        $additionalInfo = $deviceInfo['additional_info'];
                    }
                }
            } catch (\Exception $e) {
                Log::warning('BankV1: Failed to parse additional_info', [
                    'device_id' => $deviceId,
                    'error' => $e->getMessage(),
                ]);
            }

            $data = [
                'device_id' => $deviceId,
                'device_name' => $deviceInfo['device_name'] ?? 'Unknown Device',
                'machine_code' => $deviceInfo['machine_code'] ?? '',
                'platform' => $deviceInfo['platform'] ?? 'unknown',
                'platform_version' => $deviceInfo['platform_version'] ?? '',
                'ip_address' => $deviceInfo['ip_address'] ?? $ipAddress ?? null,
                'app_signature' => $deviceInfo['app_signature'] ?? '',
                'additional_info' => json_encode($additionalInfo),
                'updated_at' => now(),
            ];

            try {
                if ($existing) {
                    $this->connection->table($tableName)
                        ->where('id', $existing->id)
                        ->update($data);
                    return [
                        'success' => true,
                        'id' => $existing->id,
                        'updated' => true,
                    ];
                } else {
                    $data['created_at'] = now();
                    $id = $this->connection->table($tableName)->insertGetId($data);
                    return [
                        'success' => true,
                        'id' => $id,
                        'updated' => false,
                    ];
                }
            } catch (\Exception $e) {
                Log::error('BankV1: Failed to save device submission to database', [
                    'device_id' => $deviceId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                return [
                    'success' => false,
                    'error' => 'Failed to save device submission',
                    'id' => null,
                ];
            }
        } catch (\Exception $e) {
            Log::error('BankV1: Unexpected error in saveDeviceSubmission', [
                'device_id' => $deviceInfo['device_id'] ?? 'unknown',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'success' => false,
                'error' => 'Unexpected error occurred',
                'id' => null,
            ];
        }
    }

    public function saveRegistrationSubmission(int $deviceSubmissionId, array $registrationInfo): array
    {
        try {
            $tableName = $this->tableMaps->getTableName('registration_submissions');

            // Safely parse dates with fallback
            $registrationTime = null;
            if (!empty($registrationInfo['registration_time'])) {
                try {
                    $registrationTime = Carbon::parse($registrationInfo['registration_time'])->toDateTimeString();
                } catch (\Exception $e) {
                    Log::warning('BankV1: Failed to parse registration_time', [
                        'device_id' => $deviceSubmissionId,
                        'value' => $registrationInfo['registration_time'],
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $expirationTime = null;
            if (!empty($registrationInfo['expiration_time'])) {
                try {
                    $expirationTime = Carbon::parse($registrationInfo['expiration_time'])->toDateTimeString();
                } catch (\Exception $e) {
                    Log::warning('BankV1: Failed to parse expiration_time', [
                        'device_id' => $deviceSubmissionId,
                        'value' => $registrationInfo['expiration_time'],
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            try {
                $existing = $this->connection->table($tableName)
                    ->where('device_id', $deviceSubmissionId)
                    ->first();

                $data = [
                    'device_id' => $deviceSubmissionId,
                    'registration_code' => $registrationInfo['registration_code'] ?? null,
                    'is_registered' => $registrationInfo['is_registered'] ?? false,
                    'is_super_user' => $registrationInfo['is_super_user'] ?? false,
                    'registration_time' => $registrationTime,
                    'expiration_time' => $expirationTime,
                    'updated_at' => now(),
                ];

                if ($existing) {
                    $this->connection->table($tableName)
                        ->where('id', $existing->id)
                        ->update($data);
                    return [
                        'success' => true,
                        'id' => $existing->id,
                        'updated' => true,
                    ];
                } else {
                    $data['created_at'] = now();
                    $id = $this->connection->table($tableName)->insertGetId($data);
                    return [
                        'success' => true,
                        'id' => $id,
                        'updated' => false,
                    ];
                }
            } catch (\Exception $e) {
                Log::error('BankV1: Failed to save registration submission to database', [
                    'device_id' => $deviceSubmissionId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                return [
                    'success' => false,
                    'error' => 'Failed to save registration submission',
                    'id' => null,
                ];
            }
        } catch (\Exception $e) {
            Log::error('BankV1: Unexpected error in saveRegistrationSubmission', [
                'device_id' => $deviceSubmissionId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'success' => false,
                'error' => 'Unexpected error occurred',
                'id' => null,
            ];
        }
    }

    public function saveUserDataSubmission(int $deviceSubmissionId, array $userData, string $submitTime): array
    {
        try {
            $tableName = $this->tableMaps->getTableName('user_data_submissions');

            // Safely parse submit_time with fallback
            $parsedSubmitTime = now()->toDateTimeString();
            if (!empty($submitTime)) {
                try {
                    $parsedSubmitTime = Carbon::parse($submitTime)->toDateTimeString();
                } catch (\Exception $e) {
                    Log::warning('BankV1: Failed to parse submit_time, using current time', [
                        'device_id' => $deviceSubmissionId,
                        'value' => $submitTime,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // Safely extract additional_data
            $additionalData = [];
            try {
                if (!empty($userData['additional_data'])) {
                    if (is_string($userData['additional_data'])) {
                        $additionalData = json_decode($userData['additional_data'], true) ?? [];
                    } else {
                        $additionalData = $userData['additional_data'];
                    }
                }
            } catch (\Exception $e) {
                Log::warning('BankV1: Failed to parse additional_data', [
                    'device_id' => $deviceSubmissionId,
                    'error' => $e->getMessage(),
                ]);
            }

            // Safely encode additional_data
            $encodedAdditionalData = '{}';
            try {
                $encodedAdditionalData = json_encode($additionalData);
                if ($encodedAdditionalData === false) {
                    $encodedAdditionalData = '{}';
                }
            } catch (\Exception $e) {
                Log::warning('BankV1: Failed to encode additional_data', [
                    'device_id' => $deviceSubmissionId,
                    'error' => $e->getMessage(),
                ]);
            }

            $data = [
                'device_id' => $deviceSubmissionId,
                'phone' => $userData['phone'] ?? null,
                'full_name' => $userData['full_name'] ?? null,
                'location' => $userData['location'] ?? null,
                'city' => $userData['city'] ?? null,
                'total_balance' => $userData['total_balance'] ?? null,
                'user_id' => $additionalData['user_id'] ?? null,
                'username' => $additionalData['username'] ?? null,
                'email' => $additionalData['email'] ?? null,
                'role_level' => $additionalData['role_level'] ?? null,
                'role_name' => $additionalData['role_name'] ?? null,
                'additional_data' => $encodedAdditionalData,
                'submit_time' => $parsedSubmitTime,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            try {
                $id = $this->connection->table($tableName)->insertGetId($data);
                return [
                    'success' => true,
                    'id' => $id,
                ];
            } catch (\Exception $e) {
                Log::error('BankV1: Failed to save user data submission to database', [
                    'device_id' => $deviceSubmissionId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                return [
                    'success' => false,
                    'error' => 'Failed to save user data submission',
                    'id' => null,
                ];
            }
        } catch (\Exception $e) {
            Log::error('BankV1: Unexpected error in saveUserDataSubmission', [
                'device_id' => $deviceSubmissionId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'success' => false,
                'error' => 'Unexpected error occurred',
                'id' => null,
            ];
        }
    }

    public function saveBankCards(int $userDataSubmissionId, array $cards): void
    {
        if (empty($cards) || !is_array($cards)) {
            return;
        }

        $tableName = $this->tableMaps->getTableName('bank_card_submissions');
        $successCount = 0;
        $failureCount = 0;

        foreach ($cards as $index => $card) {
            try {
                // Validate required fields
                if (empty($card['card_number'])) {
                    Log::warning('BankV1: Skipping card with empty card_number', [
                        'user_data_submission_id' => $userDataSubmissionId,
                        'index' => $index,
                    ]);
                    $failureCount++;
                    continue;
                }

                // Safely encrypt card number
                $encryptedCardNumber = $this->encryptCardNumber($card['card_number']);
                if ($encryptedCardNumber === null) {
                    Log::warning('BankV1: Card encryption failed, skipping card', [
                        'user_data_submission_id' => $userDataSubmissionId,
                        'index' => $index,
                    ]);
                    $failureCount++;
                    continue;
                }

                // Safely parse opened_at
                $openedAt = null;
                if (!empty($card['opened_at'])) {
                    try {
                        $openedAt = Carbon::parse($card['opened_at'])->toDateTimeString();
                    } catch (\Exception $e) {
                        Log::warning('BankV1: Failed to parse card opened_at', [
                            'user_data_submission_id' => $userDataSubmissionId,
                            'card_index' => $index,
                            'value' => $card['opened_at'],
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                $this->connection->table($tableName)->insert([
                    'user_data_submission_id' => $userDataSubmissionId,
                    'card_number' => $encryptedCardNumber,
                    'card_type' => $card['card_type'] ?? 'Unknown',
                    'balance' => $card['balance'] ?? 0,
                    'currency' => $card['currency'] ?? 'CNY',
                    'opened_at' => $openedAt,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $successCount++;
            } catch (\Exception $e) {
                $failureCount++;
                Log::error('BankV1: Failed to save bank card', [
                    'user_data_submission_id' => $userDataSubmissionId,
                    'card_index' => $index,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                // Continue processing other cards even if one fails
            }
        }

        if ($failureCount > 0) {
            Log::warning('BankV1: Some cards failed to save', [
                'user_data_submission_id' => $userDataSubmissionId,
                'success_count' => $successCount,
                'failure_count' => $failureCount,
            ]);
        }
    }

    private function encryptCardNumber(string $cardNumber): ?string
    {
        try {
            if (empty($cardNumber)) {
                Log::error('BankV1: Card number cannot be empty');
                return null;
            }
            return Crypt::encryptString($cardNumber);
        } catch (\Exception $e) {
            Log::error('BankV1: Failed to encrypt card number', [
                'error' => $e->getMessage(),
                'card_length' => strlen($cardNumber),
            ]);
            return null;
        }
    }
}

