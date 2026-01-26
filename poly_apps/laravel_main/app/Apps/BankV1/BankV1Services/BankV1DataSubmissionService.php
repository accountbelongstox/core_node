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

    public function saveDeviceSubmission(array $deviceInfo, string $ipAddress): int
    {
        $tableName = $this->tableMaps->getTableName('device_submissions');

        $deviceId = $deviceInfo['device_id'];
        $existing = $this->connection->table($tableName)
            ->where('device_id', $deviceId)
            ->first();

        $data = [
            'device_id' => $deviceId,
            'device_name' => $deviceInfo['device_name'],
            'machine_code' => $deviceInfo['machine_code'],
            'platform' => $deviceInfo['platform'],
            'platform_version' => $deviceInfo['platform_version'],
            'ip_address' => $deviceInfo['ip_address'] ?? $ipAddress,
            'app_signature' => $deviceInfo['app_signature'],
            'additional_info' => json_encode($deviceInfo['additional_info'] ?? []),
            'updated_at' => now(),
        ];

        if ($existing) {
            $this->connection->table($tableName)
                ->where('id', $existing->id)
                ->update($data);
            return $existing->id;
        } else {
            $data['created_at'] = now();
            return $this->connection->table($tableName)->insertGetId($data);
        }
    }

    public function saveRegistrationSubmission(int $deviceSubmissionId, array $registrationInfo): int
    {
        $tableName = $this->tableMaps->getTableName('registration_submissions');

        $existing = $this->connection->table($tableName)
            ->where('device_id', $deviceSubmissionId)
            ->first();

        $data = [
            'device_id' => $deviceSubmissionId,
            'registration_code' => $registrationInfo['registration_code'],
            'is_registered' => $registrationInfo['is_registered'],
            'is_super_user' => $registrationInfo['is_super_user'],
            'registration_time' => $registrationInfo['registration_time'] ? Carbon::parse($registrationInfo['registration_time'])->toDateTimeString() : null,
            'expiration_time' => $registrationInfo['expiration_time'] ? Carbon::parse($registrationInfo['expiration_time'])->toDateTimeString() : null,
            'updated_at' => now(),
        ];

        if ($existing) {
            $this->connection->table($tableName)
                ->where('id', $existing->id)
                ->update($data);
            return $existing->id;
        } else {
            $data['created_at'] = now();
            return $this->connection->table($tableName)->insertGetId($data);
        }
    }

    public function saveUserDataSubmission(int $deviceSubmissionId, array $userData, string $submitTime): int
    {
        $tableName = $this->tableMaps->getTableName('user_data_submissions');

        $data = [
            'device_id' => $deviceSubmissionId,
            'phone' => $userData['phone'],
            'full_name' => $userData['full_name'],
            'location' => $userData['location'],
            'city' => $userData['city'],
            'total_balance' => $userData['total_balance'],
            'user_id' => $userData['additional_data']['user_id'] ?? null,
            'username' => $userData['additional_data']['username'] ?? null,
            'email' => $userData['additional_data']['email'] ?? null,
            'role_level' => $userData['additional_data']['role_level'] ?? null,
            'role_name' => $userData['additional_data']['role_name'] ?? null,
            'additional_data' => json_encode($userData['additional_data'] ?? []),
            'submit_time' => Carbon::parse($submitTime)->toDateTimeString(),
            'created_at' => now(),
            'updated_at' => now(),
        ];

        return $this->connection->table($tableName)->insertGetId($data);
    }

    public function saveBankCards(int $userDataSubmissionId, array $cards): void
    {
        $tableName = $this->tableMaps->getTableName('bank_card_submissions');

        foreach ($cards as $card) {
            $this->connection->table($tableName)->insert([
                'user_data_submission_id' => $userDataSubmissionId,
                'card_number' => $this->encryptCardNumber($card['card_number']),
                'card_type' => $card['card_type'],
                'balance' => $card['balance'],
                'currency' => $card['currency'],
                'opened_at' => $card['opened_at'] ? Carbon::parse($card['opened_at'])->toDateTimeString() : null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function encryptCardNumber(string $cardNumber): string
    {
        return Crypt::encryptString($cardNumber);
    }
}

