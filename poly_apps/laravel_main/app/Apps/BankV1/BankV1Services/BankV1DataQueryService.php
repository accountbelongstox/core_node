<?php

namespace App\Apps\BankV1\BankV1Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
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
        $deviceTable = $this->tableMaps->getTableName('device_submissions');
        $userDataTable = $this->tableMaps->getTableName('user_data_submissions');
        $cardTable = $this->tableMaps->getTableName('bank_card_submissions');

        $totalSubmissions = $this->connection->table($userDataTable)->count();
        $totalDevices = $this->connection->table($deviceTable)->count();
        $totalUsers = $this->connection->table($userDataTable)
            ->whereNotNull('phone')
            ->distinct('phone')
            ->count('phone');
        $totalCards = $this->connection->table($cardTable)->count();

        return [
            'total_submissions' => $totalSubmissions,
            'total_devices' => $totalDevices,
            'total_users' => $totalUsers,
            'total_cards' => $totalCards,
        ];
    }

    public function getSubmissions(array $filters = [], int $page = 1, int $perPage = 20): array
    {
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

        if (isset($filters['device_id']) && $filters['device_id']) {
            $query->where('ds.device_id', $filters['device_id']);
        }

        if (isset($filters['start_date']) && $filters['start_date']) {
            $query->where('uds.submit_time', '>=', $filters['start_date']);
        }

        if (isset($filters['end_date']) && $filters['end_date']) {
            $query->where('uds.submit_time', '<=', $filters['end_date']);
        }

        $total = $query->count();
        $submissions = $query->orderBy('uds.submit_time', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'device_id' => $item->device_id,
                    'device_name' => $item->device_name,
                    'platform' => $item->platform,
                    'phone' => $item->phone,
                    'full_name' => $item->full_name,
                    'total_balance' => $item->total_balance ? (float)$item->total_balance : null,
                    'submit_time' => $item->submit_time,
                    'created_at' => $item->created_at,
                ];
            })
            ->toArray();

        return [
            'data' => $submissions,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => ceil($total / $perPage),
            ],
        ];
    }
}

