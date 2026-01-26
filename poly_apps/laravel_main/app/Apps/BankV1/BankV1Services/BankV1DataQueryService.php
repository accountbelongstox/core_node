<?php

namespace App\Apps\BankV1\BankV1Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Apps\BankV1\BankV1TablesMaps\BankV1TablesMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class BankV1DataQueryService
{
    private $tableMaps;
    private $connection;

    public function __construct()
    {
        $this->tableMaps = new BankV1TablesMaps();
        $connectionName = AppTablePrefixServiceProvider::getConnection(AppKeys::BANKV1);
        $this->connection = DB::connection($connectionName);
    }

    public function getStats(): array
    {
        try {
            $deviceTable = $this->tableMaps->getTableName('device_submissions');
            $userDataTable = $this->tableMaps->getTableName('user_data_submissions');
            $cardTable = $this->tableMaps->getTableName('bank_card_submissions');

            // Use try-catch for each query to handle individual failures gracefully
            $totalSubmissions = 0;
            try {
                $totalSubmissions = $this->connection->table($userDataTable)->count();
            } catch (\Exception $e) {
                Log::warning('BankV1: Failed to count submissions', ['error' => $e->getMessage()]);
            }

            $totalDevices = 0;
            try {
                $totalDevices = $this->connection->table($deviceTable)->count();
            } catch (\Exception $e) {
                Log::warning('BankV1: Failed to count devices', ['error' => $e->getMessage()]);
            }

            $totalUsers = 0;
            try {
                $totalUsers = $this->connection->table($userDataTable)
                    ->whereNotNull('phone')
                    ->distinct('phone')
                    ->count('phone');
            } catch (\Exception $e) {
                Log::warning('BankV1: Failed to count users', ['error' => $e->getMessage()]);
            }

            $totalCards = 0;
            try {
                $totalCards = $this->connection->table($cardTable)->count();
            } catch (\Exception $e) {
                Log::warning('BankV1: Failed to count cards', ['error' => $e->getMessage()]);
            }

            return [
                'total_submissions' => $totalSubmissions,
                'total_devices' => $totalDevices,
                'total_users' => $totalUsers,
                'total_cards' => $totalCards,
            ];
        } catch (\Exception $e) {
            Log::error('BankV1: Failed to get stats', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            // Return default values instead of throwing
            return [
                'total_submissions' => 0,
                'total_devices' => 0,
                'total_users' => 0,
                'total_cards' => 0,
            ];
        }
    }

    public function getSubmissions(array $filters = [], int $page = 1, int $perPage = 20): array
    {
        try {
            // Validate and sanitize inputs
            $page = max(1, (int)$page);
            $perPage = max(1, min(100, (int)$perPage)); // Limit per_page to 100

            $deviceTable = $this->tableMaps->getTableName('device_submissions');
            $userDataTable = $this->tableMaps->getTableName('user_data_submissions');

            $query = $this->connection->table($userDataTable . ' as uds')
                ->join($deviceTable . ' as ds', 'uds.device_id', '=', 'ds.id')
                ->select(
                    'uds.id',
                    'ds.device_id',
                    'ds.device_name',
                    'ds.platform',
                    'uds.phone',
                    'uds.full_name',
                    'uds.total_balance',
                    'uds.submit_time',
                    'uds.created_at'
                );

            // Apply filters safely
            if (!empty($filters['device_id'])) {
                $query->where('ds.device_id', $filters['device_id']);
            }

            if (!empty($filters['start_date'])) {
                try {
                    // Validate date format
                    $startDate = Carbon::parse($filters['start_date'])->toDateTimeString();
                    $query->where('uds.submit_time', '>=', $startDate);
                } catch (\Exception $e) {
                    Log::warning('BankV1: Invalid start_date filter', [
                        'value' => $filters['start_date'],
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            if (!empty($filters['end_date'])) {
                try {
                    // Validate date format
                    $endDate = Carbon::parse($filters['end_date'])->toDateTimeString();
                    $query->where('uds.submit_time', '<=', $endDate);
                } catch (\Exception $e) {
                    Log::warning('BankV1: Invalid end_date filter', [
                        'value' => $filters['end_date'],
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $total = 0;
            try {
                $total = $query->count();
            } catch (\Exception $e) {
                Log::error('BankV1: Failed to count submissions', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                return [
                    'data' => [],
                    'pagination' => [
                        'current_page' => $page,
                        'per_page' => $perPage,
                        'total' => 0,
                        'total_pages' => 0,
                    ],
                    'error' => 'Failed to count submissions',
                ];
            }

            $submissions = [];
            try {
                $submissions = $query->orderBy('uds.submit_time', 'desc')
                    ->skip(($page - 1) * $perPage)
                    ->take($perPage)
                    ->get()
                    ->map(function ($item) {
                        return [
                            'id' => $item->id ?? null,
                            'device_id' => $item->device_id ?? null,
                            'device_name' => $item->device_name ?? 'Unknown',
                            'platform' => $item->platform ?? 'unknown',
                            'phone' => $item->phone ?? null,
                            'full_name' => $item->full_name ?? null,
                            'total_balance' => isset($item->total_balance) ? (float)$item->total_balance : null,
                            'submit_time' => $item->submit_time ?? null,
                            'created_at' => $item->created_at ?? null,
                        ];
                    })
                    ->toArray();
            } catch (\Exception $e) {
                Log::error('BankV1: Failed to fetch submissions', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                return [
                    'data' => [],
                    'pagination' => [
                        'current_page' => $page,
                        'per_page' => $perPage,
                        'total' => 0,
                        'total_pages' => 0,
                    ],
                    'error' => 'Failed to fetch submissions',
                ];
            }

            return [
                'data' => $submissions,
                'pagination' => [
                    'current_page' => $page,
                    'per_page' => $perPage,
                    'total' => $total,
                    'total_pages' => $total > 0 ? ceil($total / $perPage) : 0,
                ],
            ];
        } catch (\Exception $e) {
            Log::error('BankV1: Unexpected error in getSubmissions', [
                'filters' => $filters,
                'page' => $page,
                'per_page' => $perPage,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'data' => [],
                'pagination' => [
                    'current_page' => $page,
                    'per_page' => $perPage,
                    'total' => 0,
                    'total_pages' => 0,
                ],
                'error' => 'Unexpected error occurred',
            ];
        }
    }
}

