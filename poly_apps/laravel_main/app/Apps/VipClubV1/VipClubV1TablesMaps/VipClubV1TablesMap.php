<?php

namespace App\Apps\VipClubV1\VipClubV1TablesMaps;

use App\Providers\GlobalTablesMap;

class VipClubV1TablesMap
{
    public const FACILITIES = [
        'tablename' => 'vipclubv1_facilities',
        'fields' => [
            'id' => 'id',
            'name' => 'name',
            'type' => 'type',
            'description' => 'description',
            'image_url' => 'image_url',
            'base_price' => 'base_price',
            'available_times' => 'available_times',
            'features' => 'features',
            'is_active' => 'is_active',
            'vip_only' => 'vip_only',
            'specific_data' => 'specific_data',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const BOOKINGS = [
        'tablename' => 'vipclubv1_bookings',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'facility_id' => 'facility_id',
            'facility_type' => 'facility_type',
            'facility_name' => 'facility_name',
            'booking_date' => 'booking_date',
            'time_slot' => 'time_slot',
            'duration' => 'duration',
            'price' => 'price',
            'discount' => 'discount',
            'final_price' => 'final_price',
            'status' => 'status',
            'extras' => 'extras',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const VIP_CARDS = [
        'tablename' => 'vipclubv1_vip_cards',
        'fields' => [
            'id' => 'id',
            'card_number' => 'card_number',
            'user_id' => 'user_id',
            'member_type' => 'member_type',
            'issue_date' => 'issue_date',
            'expiry_date' => 'expiry_date',
            'points' => 'points',
            'benefits' => 'benefits',
            'qr_code' => 'qr_code',
            'is_active' => 'is_active',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const POINTS_TRANSACTIONS = [
        'tablename' => 'vipclubv1_points_transactions',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'points' => 'points',
            'type' => 'type',
            'description' => 'description',
            'related_booking_id' => 'related_booking_id',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const ARTICLES = [
        'tablename' => 'vipclubv1_articles',
        'fields' => [
            'id' => 'id',
            'title' => 'title',
            'summary' => 'summary',
            'content' => 'content',
            'category' => 'category',
            'cover_image_url' => 'cover_image_url',
            'author' => 'author',
            'publish_date' => 'publish_date',
            'read_count' => 'read_count',
            'tags' => 'tags',
            'is_featured' => 'is_featured',
            'is_published' => 'is_published',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const PAYMENTS = [
        'tablename' => 'vipclubv1_payments',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'booking_id' => 'booking_id',
            'payment_type' => 'payment_type',
            'membership_tier' => 'membership_tier',
            'amount' => 'amount',
            'currency' => 'currency',
            'payment_method' => 'payment_method',
            'payment_status' => 'payment_status',
            'transaction_id' => 'transaction_id',
            'payment_intent_id' => 'payment_intent_id',
            'client_secret' => 'client_secret',
            'receipt_url' => 'receipt_url',
            'payment_details' => 'payment_details',
            'paid_at' => 'paid_at',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const SUPPORT_MESSAGES = [
        'tablename' => 'vipclubv1_support_messages',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'message' => 'message',
            'attachments' => 'attachments',
            'is_from_user' => 'is_from_user',
            'is_read' => 'is_read',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const SUPPORT_CONFIG = [
        'tablename' => 'vipclubv1_support_config',
        'fields' => [
            'id' => 'id',
            'phone' => 'phone',
            'email' => 'email',
            'wechat' => 'wechat',
            'whatsapp' => 'whatsapp',
            'hours' => 'hours',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    public const USERS = GlobalTablesMap::GLOBAL_USERS;

    public static function getTableName(string $tableKey): string
    {
        $constantName = strtoupper($tableKey);
        if (defined("self::{$constantName}")) {
            return constant("self::{$constantName}")['tablename'];
        }
        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in VipClubV1TablesMap");
    }

    public static function getFieldName(string $tableKey, string $fieldKey): string
    {
        $constantName = strtoupper($tableKey);
        if (defined("self::{$constantName}")) {
            $tableMap = constant("self::{$constantName}");
            if (isset($tableMap['fields'][$fieldKey])) {
                return $tableMap['fields'][$fieldKey];
            }
            throw new \InvalidArgumentException("Field key '{$fieldKey}' not found in table '{$tableKey}'");
        }
        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in VipClubV1TablesMap");
    }

    public static function getTableFields(string $tableKey): array
    {
        $constantName = strtoupper($tableKey);
        if (defined("self::{$constantName}")) {
            return constant("self::{$constantName}")['fields'];
        }
        throw new \InvalidArgumentException("Table key '{$tableKey}' not found in VipClubV1TablesMap");
    }

    public static function getAvailableTableKeys(): array
    {
        return [
            'FACILITIES',
            'BOOKINGS',
            'VIP_CARDS',
            'POINTS_TRANSACTIONS',
            'ARTICLES',
            'PAYMENTS',
            'SUPPORT_MESSAGES',
            'SUPPORT_CONFIG',
            'USERS'
        ];
    }

    public static function hasTableKey(string $tableKey): bool
    {
        $constantName = strtoupper($tableKey);
        return defined("self::{$constantName}");
    }

    public static function getAllTableMappings(): array
    {
        $mappings = [];
        foreach (self::getAvailableTableKeys() as $tableKey) {
            $constantName = strtoupper($tableKey);
            if (defined("self::{$constantName}")) {
                $mappings[$tableKey] = constant("self::{$constantName}");
            }
        }
        return $mappings;
    }
}
