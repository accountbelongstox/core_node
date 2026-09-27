<?php

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Enums;

/**
 * Lifecycle state of a recharge order (recharge_orders.status).
 */
enum DingDuoDuoV1OrderStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Failed = 'failed';
    case Refunded = 'refunded';
}
