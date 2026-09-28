<?php

namespace App\Http\Api;
use App\Http\Controllers\Controller;
use App\Helpers\GlobalVar;

class TestController extends Controller
{

    public function index()
    {
        $globalVar = GlobalVar::all();
        return response()->json(['status' => 'working', 'globalVar' => $globalVar   ]);
    }
}
