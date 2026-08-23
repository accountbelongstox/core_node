<?php

namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1PublicHomeService;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

class CodeMartV1PublicHomeCtl extends Controller
{
    use ApiResponse;

    private CodeMartV1PublicHomeService $publicHomeService;

    public function __construct(CodeMartV1PublicHomeService $publicHomeService)
    {
        $this->publicHomeService = $publicHomeService;
    }

    public function getHome(): JsonResponse
    {
        return $this->success($this->publicHomeService->getHome());
    }
}
