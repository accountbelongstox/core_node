<?php

namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1PolicyService;
use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use Illuminate\Http\Request;

/**
 * Single reader of list paging parameters: `page` and the page size, which
 * clients may send as `page_size` (canonical) or `pageSize` (legacy alias).
 */
class CodeMartV1Pagination
{
    /** @return array{0: int, 1: int} [page, pageSize] */
    public static function params(Request $request): array
    {
        $page = max(1, (int) $request->input('page', 1));
        $size = $request->input('page_size', $request->input('pageSize', CodeMartV1PolicyService::int('default_page_size')));
        $pageSize = min(CodeMartV1PolicyService::int('max_page_size'), max(1, (int) $size));

        return [$page, $pageSize];
    }
}
