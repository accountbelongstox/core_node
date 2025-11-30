<?php

use Illuminate\Support\Facades\Route;
use App\Apps\VipClubV1\VipClubV1AuthCtl\VipClubV1AuthCtl;
use App\Apps\VipClubV1\VipClubV1FacilitiesCtl\VipClubV1FacilitiesCtl;
use App\Apps\VipClubV1\VipClubV1BookingsCtl\VipClubV1BookingsCtl;
use App\Apps\VipClubV1\VipClubV1VipCtl\VipClubV1VipCtl;
use App\Apps\VipClubV1\VipClubV1ArticlesCtl\VipClubV1ArticlesCtl;
use App\Apps\VipClubV1\VipClubV1PaymentsCtl\VipClubV1PaymentsCtl;
use App\Apps\VipClubV1\VipClubV1SupportCtl\VipClubV1SupportCtl;

Route::prefix('vipclubv1/v1')->group(function () {

    Route::prefix('auth')->group(function () {
        Route::post('/register', [VipClubV1AuthCtl::class, 'register']);
        Route::post('/login', [VipClubV1AuthCtl::class, 'login']);

        Route::middleware('auth:sanctum')->group(function () {
            Route::post('/logout', [VipClubV1AuthCtl::class, 'logout']);
            Route::get('/profile', [VipClubV1AuthCtl::class, 'profile']);
            Route::put('/profile', [VipClubV1AuthCtl::class, 'updateProfile']);
        });
    });

    Route::prefix('facilities')->group(function () {
        Route::get('/', [VipClubV1FacilitiesCtl::class, 'index']);
        Route::get('/{id}', [VipClubV1FacilitiesCtl::class, 'show']);
        Route::get('/{id}/slots', [VipClubV1FacilitiesCtl::class, 'getAvailableSlots']);
    });

    Route::get('/facilities/availability', [VipClubV1FacilitiesCtl::class, 'checkAvailability']);

    Route::prefix('bookings')->middleware('auth:sanctum')->group(function () {
        Route::post('/', [VipClubV1BookingsCtl::class, 'create']);
        Route::get('/my', [VipClubV1BookingsCtl::class, 'myBookings']);
        Route::get('/{id}', [VipClubV1BookingsCtl::class, 'show']);
        Route::put('/{id}', [VipClubV1BookingsCtl::class, 'update']);
        Route::put('/{id}/cancel', [VipClubV1BookingsCtl::class, 'cancel']);
    });

    Route::prefix('vip')->group(function () {
        Route::get('/benefits', [VipClubV1VipCtl::class, 'getBenefits']);

        Route::middleware('auth:sanctum')->group(function () {
            Route::get('/card', [VipClubV1VipCtl::class, 'getMyCard']);
            Route::get('/points/history', [VipClubV1VipCtl::class, 'getPointsHistory']);
            Route::get('/membership', [VipClubV1VipCtl::class, 'getMyMembershipInfo']);
        });
    });

    Route::prefix('memberships')->group(function () {
        Route::get('/tiers', [VipClubV1VipCtl::class, 'getMembershipTiers']);

        Route::middleware('auth:sanctum')->group(function () {
            Route::post('/subscribe', [VipClubV1VipCtl::class, 'subscribe']);
            Route::post('/upgrade', [VipClubV1VipCtl::class, 'upgrade']);
        });
    });

    Route::prefix('articles')->group(function () {
        Route::get('/', [VipClubV1ArticlesCtl::class, 'index']);
        Route::get('/categories', [VipClubV1ArticlesCtl::class, 'getCategories']);
        Route::get('/featured', [VipClubV1ArticlesCtl::class, 'getFeatured']);
        Route::get('/{id}', [VipClubV1ArticlesCtl::class, 'show']);
    });

    Route::prefix('payments')->middleware('auth:sanctum')->group(function () {
        Route::post('/create', [VipClubV1PaymentsCtl::class, 'create']);
        Route::post('/confirm', [VipClubV1PaymentsCtl::class, 'confirm']);
        Route::get('/history', [VipClubV1PaymentsCtl::class, 'history']);
        Route::get('/{id}/receipt', [VipClubV1PaymentsCtl::class, 'getReceipt']);
    });

    Route::prefix('support')->group(function () {
        Route::get('/info', [VipClubV1SupportCtl::class, 'getInfo']);

        Route::middleware('auth:sanctum')->group(function () {
            Route::post('/messages', [VipClubV1SupportCtl::class, 'sendMessage']);
            Route::get('/messages', [VipClubV1SupportCtl::class, 'getMessages']);
            Route::put('/messages/{id}/read', [VipClubV1SupportCtl::class, 'markAsRead']);
        });
    });

});
