<?php

namespace App\Apps\VipClubV1\VipClubV1ApiInfo;

class VipClubV1ApiInfo
{
    public static function getApiInfo(): array
    {
        return [
            'app_name' => 'VipClubV1',
            'app_version' => 'v1',
            'base_path' => '/api/vipclubv1/v1',
            'supported_headers' => [
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer {token} (required for authenticated endpoints)'
            ],
            'apis' => [
                'auth' => [
                    'register' => [
                        'path' => '/api/vipclubv1/v1/auth/register',
                        'method' => 'POST',
                        'authentication_required' => false,
                        'description' => 'Register a new user account',
                        'request_body' => [
                            'email' => 'string (required, email format)',
                            'password' => 'string (required, min:6)',
                            'full_name' => 'string (required)',
                            'phone' => 'string (optional)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'message' => 'string',
                            'data' => [
                                'token' => 'string',
                                'user' => 'UserModel'
                            ]
                        ],
                        'feature' => 'user_registration'
                    ],
                    'login' => [
                        'path' => '/api/vipclubv1/v1/auth/login',
                        'method' => 'POST',
                        'authentication_required' => false,
                        'description' => 'Login with email and password',
                        'request_body' => [
                            'email' => 'string (required)',
                            'password' => 'string (required)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'message' => 'string',
                            'data' => [
                                'token' => 'string',
                                'user' => 'UserModel'
                            ]
                        ],
                        'feature' => 'user_authentication'
                    ],
                    'logout' => [
                        'path' => '/api/vipclubv1/v1/auth/logout',
                        'method' => 'POST',
                        'authentication_required' => true,
                        'description' => 'Logout current user',
                        'request_body' => [],
                        'response_format' => [
                            'success' => 'boolean',
                            'message' => 'string'
                        ],
                        'feature' => 'user_authentication'
                    ],
                    'profile_get' => [
                        'path' => '/api/vipclubv1/v1/auth/profile',
                        'method' => 'GET',
                        'authentication_required' => true,
                        'description' => 'Get current user profile',
                        'query_params' => [],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => 'UserModel'
                        ],
                        'feature' => 'user_profile'
                    ],
                    'profile_update' => [
                        'path' => '/api/vipclubv1/v1/auth/profile',
                        'method' => 'PUT',
                        'authentication_required' => true,
                        'description' => 'Update current user profile',
                        'request_body' => [
                            'full_name' => 'string (optional)',
                            'phone' => 'string (optional)',
                            'avatar_url' => 'string (optional, URL)',
                            'preferences' => 'object (optional)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => 'UserModel'
                        ],
                        'feature' => 'user_profile'
                    ]
                ],
                'facilities' => [
                    'list' => [
                        'path' => '/api/vipclubv1/v1/facilities',
                        'method' => 'GET',
                        'authentication_required' => false,
                        'description' => 'Get list of all facilities',
                        'query_params' => [
                            'type' => 'string (optional: shooting|golf|hotel)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'facilities' => 'FacilityModel[]',
                                'total' => 'number'
                            ]
                        ],
                        'feature' => 'facility_list|filter_by_type'
                    ],
                    'detail' => [
                        'path' => '/api/vipclubv1/v1/facilities/{id}',
                        'method' => 'GET',
                        'authentication_required' => false,
                        'description' => 'Get facility details by ID',
                        'path_params' => [
                            'id' => 'integer (facility ID)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => 'FacilityModel'
                        ],
                        'feature' => 'facility_detail|vip_access_control'
                    ],
                    'available_slots' => [
                        'path' => '/api/vipclubv1/v1/facilities/{id}/slots',
                        'method' => 'GET',
                        'authentication_required' => false,
                        'description' => 'Get available time slots for a facility',
                        'path_params' => [
                            'id' => 'integer (facility ID)'
                        ],
                        'query_params' => [
                            'date' => 'string (required, ISO 8601 date format)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'date' => 'string',
                                'facility_id' => 'integer',
                                'available_slots' => 'string[]'
                            ]
                        ],
                        'feature' => 'availability_check|time_slot_management'
                    ],
                    'check_availability' => [
                        'path' => '/api/vipclubv1/v1/facilities/availability',
                        'method' => 'GET',
                        'authentication_required' => false,
                        'description' => 'Check if specific time slot is available',
                        'query_params' => [
                            'facility_id' => 'integer (required)',
                            'date' => 'string (required, ISO 8601)',
                            'time_slot' => 'string (required)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'facility_id' => 'integer',
                                'date' => 'string',
                                'time_slot' => 'string',
                                'available' => 'boolean'
                            ]
                        ],
                        'feature' => 'availability_check'
                    ]
                ],
                'bookings' => [
                    'create' => [
                        'path' => '/api/vipclubv1/v1/bookings',
                        'method' => 'POST',
                        'authentication_required' => true,
                        'description' => 'Create a new booking',
                        'request_body' => [
                            'facility_type' => 'string (required: shooting|golf|hotel)',
                            'facility_id' => 'integer (required)',
                            'booking_date' => 'string (required, ISO 8601 date)',
                            'time_slot' => 'string (required)',
                            'duration' => 'integer (optional, default:1)',
                            'extras' => 'object (optional)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => 'BookingModel'
                        ],
                        'feature' => 'booking_creation|discount_calculation|points_earning|auto_tier_upgrade'
                    ],
                    'my_bookings' => [
                        'path' => '/api/vipclubv1/v1/bookings/my',
                        'method' => 'GET',
                        'authentication_required' => true,
                        'description' => 'Get current user bookings',
                        'query_params' => [
                            'status' => 'string (optional: pending|confirmed|cancelled|completed)',
                            'page' => 'integer (optional, default:1)',
                            'limit' => 'integer (optional, default:20, max:100)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'items' => 'BookingModel[]',
                                'pagination' => 'PaginationModel'
                            ]
                        ],
                        'feature' => 'booking_list|filter_by_status|pagination'
                    ],
                    'detail' => [
                        'path' => '/api/vipclubv1/v1/bookings/{id}',
                        'method' => 'GET',
                        'authentication_required' => true,
                        'description' => 'Get booking details by ID',
                        'path_params' => [
                            'id' => 'integer (booking ID)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => 'BookingModel'
                        ],
                        'feature' => 'booking_detail|authorization_check'
                    ],
                    'update' => [
                        'path' => '/api/vipclubv1/v1/bookings/{id}',
                        'method' => 'PUT',
                        'authentication_required' => true,
                        'description' => 'Update booking (date, time, duration)',
                        'path_params' => [
                            'id' => 'integer (booking ID)'
                        ],
                        'request_body' => [
                            'booking_date' => 'string (optional, ISO 8601)',
                            'time_slot' => 'string (optional)',
                            'duration' => 'integer (optional)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => 'BookingModel'
                        ],
                        'feature' => 'booking_modification|availability_validation|deadline_check'
                    ],
                    'cancel' => [
                        'path' => '/api/vipclubv1/v1/bookings/{id}/cancel',
                        'method' => 'PUT',
                        'authentication_required' => true,
                        'description' => 'Cancel a booking',
                        'path_params' => [
                            'id' => 'integer (booking ID)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => 'BookingModel'
                        ],
                        'feature' => 'booking_cancellation|deadline_validation'
                    ]
                ],
                'vip' => [
                    'benefits' => [
                        'path' => '/api/vipclubv1/v1/vip/benefits',
                        'method' => 'GET',
                        'authentication_required' => false,
                        'description' => 'Get VIP benefits by member type',
                        'query_params' => [
                            'member_type' => 'string (optional: regular|gold|platinum|diamond)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'member_type' => 'string',
                                'benefits' => 'string[]',
                                'discount_rate' => 'number'
                            ]
                        ],
                        'feature' => 'benefit_information'
                    ],
                    'my_card' => [
                        'path' => '/api/vipclubv1/v1/vip/card',
                        'method' => 'GET',
                        'authentication_required' => true,
                        'description' => 'Get current user VIP card',
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => 'VipCardModel'
                        ],
                        'feature' => 'vip_card_display'
                    ],
                    'points_history' => [
                        'path' => '/api/vipclubv1/v1/vip/points/history',
                        'method' => 'GET',
                        'authentication_required' => true,
                        'description' => 'Get points transaction history',
                        'query_params' => [
                            'type' => 'string (optional: earn|redeem)',
                            'page' => 'integer (optional, default:1)',
                            'limit' => 'integer (optional, default:20, max:100)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'current_points' => 'integer',
                                'current_tier' => 'string',
                                'points_to_next_tier' => 'integer|null',
                                'transactions' => [
                                    'items' => 'PointsTransactionModel[]',
                                    'pagination' => 'PaginationModel'
                                ]
                            ]
                        ],
                        'feature' => 'points_history|tier_progress|pagination'
                    ],
                    'membership_info' => [
                        'path' => '/api/vipclubv1/v1/vip/membership',
                        'method' => 'GET',
                        'authentication_required' => true,
                        'description' => 'Get current user membership information',
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'member_type' => 'string',
                                'vip_points' => 'integer',
                                'points_to_next_tier' => 'integer|null',
                                'discount_rate' => 'number',
                                'benefits' => 'string[]',
                                'member_since' => 'string (ISO 8601)',
                                'member_expiry' => 'string (ISO 8601)',
                                'card' => 'VipCardModel|null'
                            ]
                        ],
                        'feature' => 'membership_dashboard|tier_information'
                    ]
                ],
                'memberships' => [
                    'tiers' => [
                        'path' => '/api/vipclubv1/v1/memberships/tiers',
                        'method' => 'GET',
                        'authentication_required' => false,
                        'description' => 'Get all membership tiers information',
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'tiers' => 'TierModel[]'
                            ]
                        ],
                        'feature' => 'tier_information|upgrade_guide'
                    ],
                    'subscribe' => [
                        'path' => '/api/vipclubv1/v1/memberships/subscribe',
                        'method' => 'POST',
                        'authentication_required' => true,
                        'description' => 'Subscribe to a membership tier',
                        'request_body' => [
                            'tier' => 'string (required: regular|gold|platinum|diamond)',
                            'payment_method' => 'string (required)',
                            'payment_token' => 'string (required)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'success' => 'boolean',
                                'vip_card' => 'VipCardModel',
                                'transaction_id' => 'string'
                            ]
                        ],
                        'feature' => 'membership_subscription|payment_processing'
                    ],
                    'upgrade' => [
                        'path' => '/api/vipclubv1/v1/memberships/upgrade',
                        'method' => 'POST',
                        'authentication_required' => true,
                        'description' => 'Upgrade membership to a higher tier',
                        'request_body' => [
                            'new_tier' => 'string (required: gold|platinum|diamond)',
                            'payment_method' => 'string (required)',
                            'payment_token' => 'string (required)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'success' => 'boolean',
                                'vip_card' => 'VipCardModel',
                                'transaction_id' => 'string'
                            ]
                        ],
                        'feature' => 'membership_upgrade|payment_processing'
                    ]
                ],
                'articles' => [
                    'list' => [
                        'path' => '/api/vipclubv1/v1/articles',
                        'method' => 'GET',
                        'authentication_required' => false,
                        'description' => 'Get list of articles',
                        'query_params' => [
                            'category' => 'string (optional: news|events|tips|promotions|announcements)',
                            'page' => 'integer (optional, default:1)',
                            'limit' => 'integer (optional, default:20, max:100)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'items' => 'ArticleModel[]',
                                'pagination' => 'PaginationModel'
                            ]
                        ],
                        'feature' => 'article_list|filter_by_category|pagination'
                    ],
                    'detail' => [
                        'path' => '/api/vipclubv1/v1/articles/{id}',
                        'method' => 'GET',
                        'authentication_required' => false,
                        'description' => 'Get article details by ID',
                        'path_params' => [
                            'id' => 'integer (article ID)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => 'ArticleModel'
                        ],
                        'feature' => 'article_detail|view_count_increment'
                    ],
                    'categories' => [
                        'path' => '/api/vipclubv1/v1/articles/categories',
                        'method' => 'GET',
                        'authentication_required' => false,
                        'description' => 'Get all article categories',
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'categories' => 'string[]'
                            ]
                        ],
                        'feature' => 'category_list'
                    ],
                    'featured' => [
                        'path' => '/api/vipclubv1/v1/articles/featured',
                        'method' => 'GET',
                        'authentication_required' => false,
                        'description' => 'Get featured articles',
                        'query_params' => [
                            'limit' => 'integer (optional, default:5, max:20)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'featured_articles' => 'ArticleModel[]'
                            ]
                        ],
                        'feature' => 'featured_articles'
                    ]
                ],
                'payments' => [
                    'create' => [
                        'path' => '/api/vipclubv1/v1/payments/create',
                        'method' => 'POST',
                        'authentication_required' => true,
                        'description' => 'Create a payment intent',
                        'request_body' => [
                            'booking_id' => 'integer (optional, for booking payments)',
                            'membership_tier' => 'string (optional, for membership payments)',
                            'amount' => 'number (required)',
                            'currency' => 'string (optional, default:USD)',
                            'payment_method' => 'string (required: stripe|paypal|wechat|alipay|credit_card)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'payment_id' => 'integer',
                                'payment_intent_id' => 'string',
                                'client_secret' => 'string',
                                'amount' => 'number',
                                'currency' => 'string',
                                'status' => 'string'
                            ]
                        ],
                        'feature' => 'payment_intent_creation'
                    ],
                    'confirm' => [
                        'path' => '/api/vipclubv1/v1/payments/confirm',
                        'method' => 'POST',
                        'authentication_required' => true,
                        'description' => 'Confirm a payment',
                        'request_body' => [
                            'payment_id' => 'integer (required)',
                            'payment_token' => 'string (required)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'success' => 'boolean',
                                'transaction_id' => 'string',
                                'receipt_url' => 'string',
                                'payment' => 'PaymentModel'
                            ]
                        ],
                        'feature' => 'payment_confirmation|booking_confirmation'
                    ],
                    'history' => [
                        'path' => '/api/vipclubv1/v1/payments/history',
                        'method' => 'GET',
                        'authentication_required' => true,
                        'description' => 'Get payment history',
                        'query_params' => [
                            'page' => 'integer (optional, default:1)',
                            'limit' => 'integer (optional, default:20, max:100)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'items' => 'PaymentModel[]',
                                'pagination' => 'PaginationModel'
                            ]
                        ],
                        'feature' => 'payment_history|pagination'
                    ],
                    'receipt' => [
                        'path' => '/api/vipclubv1/v1/payments/{id}/receipt',
                        'method' => 'GET',
                        'authentication_required' => true,
                        'description' => 'Get payment receipt',
                        'path_params' => [
                            'id' => 'integer (payment ID)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'receipt' => 'ReceiptModel'
                            ]
                        ],
                        'feature' => 'payment_receipt'
                    ]
                ],
                'support' => [
                    'send_message' => [
                        'path' => '/api/vipclubv1/v1/support/messages',
                        'method' => 'POST',
                        'authentication_required' => true,
                        'description' => 'Send a message to customer support',
                        'request_body' => [
                            'message' => 'string (required, max:5000)',
                            'attachments' => 'string[] (optional, max:5)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'message_id' => 'integer',
                                'created_at' => 'string'
                            ]
                        ],
                        'feature' => 'customer_support|message_submission'
                    ],
                    'get_messages' => [
                        'path' => '/api/vipclubv1/v1/support/messages',
                        'method' => 'GET',
                        'authentication_required' => true,
                        'description' => 'Get support message history',
                        'query_params' => [
                            'page' => 'integer (optional, default:1)',
                            'limit' => 'integer (optional, default:20, max:100)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'messages' => 'MessageModel[]',
                                'total' => 'integer',
                                'unread_count' => 'integer',
                                'pagination' => 'PaginationModel'
                            ]
                        ],
                        'feature' => 'message_history|unread_count|pagination'
                    ],
                    'mark_as_read' => [
                        'path' => '/api/vipclubv1/v1/support/messages/{id}/read',
                        'method' => 'PUT',
                        'authentication_required' => true,
                        'description' => 'Mark a message as read',
                        'path_params' => [
                            'id' => 'integer (message ID)'
                        ],
                        'response_format' => [
                            'success' => 'boolean',
                            'message' => 'string'
                        ],
                        'feature' => 'message_read_status'
                    ],
                    'info' => [
                        'path' => '/api/vipclubv1/v1/support/info',
                        'method' => 'GET',
                        'authentication_required' => false,
                        'description' => 'Get customer support contact information',
                        'response_format' => [
                            'success' => 'boolean',
                            'data' => [
                                'phone' => 'string',
                                'email' => 'string',
                                'wechat' => 'string',
                                'whatsapp' => 'string',
                                'hours' => 'string'
                            ]
                        ],
                        'feature' => 'support_contact_info'
                    ]
                ]
            ]
        ];
    }
}
