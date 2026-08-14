<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1Order;

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1BatchOrderModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1BatchPurchaseOrderModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1UsageLogModel;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1ProfileResolver;

/**
 * Batch-order submission + retrieval, and order-link conversion. All actions
 * behind 'custom.authenticate' (Sanctum bearer token).
 */
class PddToolV1OrderController extends BaseController
{
    /**
     * POST /batch-orders {purchaseOrders:[{purchase_order_no,goods_id,sku_id,quantity}]}
     *   -> {data:{batchId,count}}
     */
    public function createBatch(Request $request): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }
        $profile = PddToolV1ProfileResolver::profile($request);

        $purchaseOrders = $request->input('purchaseOrders', []);
        if (!is_array($purchaseOrders) || count($purchaseOrders) === 0) {
            return response()->json(['detail' => 'purchaseOrders is required'], 422);
        }

        // Server-authoritative order cap. max_orders -1 = unlimited.
        $max = (int) ($profile->max_orders ?? 0);
        if ($max >= 0 && count($purchaseOrders) > $max) {
            return response()->json(['detail' => 'Order count exceeds your plan limit'], 403);
        }

        $batchId = 'B' . now()->format('YmdHis') . strtoupper(Str::random(6));

        $header = new PddToolV1BatchOrderModel();
        $header->user_id = $user->id;
        $header->batch_id = $batchId;
        $header->order_count = count($purchaseOrders);
        $header->status = 'created';
        $header->saveRecord();

        foreach ($purchaseOrders as $po) {
            $po = (array) $po;
            $row = new PddToolV1BatchPurchaseOrderModel();
            $row->batch_id = $batchId;
            $row->user_id = $user->id;
            $row->purchase_order_no = (string) ($po['purchase_order_no'] ?? '');
            $row->goods_id = (string) ($po['goods_id'] ?? '');
            $row->sku_id = (string) ($po['sku_id'] ?? '');
            $row->quantity = (int) ($po['quantity'] ?? 1);
            $row->status = 'pending';
            $row->saveRecord();
        }

        PddToolV1UsageLogModel::record($user->id, 'batch_order', [
            'batch_id' => $batchId,
            'count' => count($purchaseOrders),
        ]);

        return response()->json([
            'data' => [
                'batchId' => $batchId,
                'count' => count($purchaseOrders),
            ],
        ]);
    }

    /**
     * GET /batch-orders/{batchId}/purchase-orders
     *   -> {success:true,data:{purchaseOrders:[...]}}
     */
    public function getPurchaseOrders(Request $request, string $batchId): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $rows = PddToolV1BatchPurchaseOrderModel::forUserBatch((int) $user->id, $batchId);

        $purchaseOrders = $rows->map(fn ($r) => [
            'purchase_order_no' => (string) $r->purchase_order_no,
            'goods_id' => (string) $r->goods_id,
            'sku_id' => (string) $r->sku_id,
            'quantity' => (int) $r->quantity,
            'status' => (string) $r->status,
        ])->all();

        return response()->json([
            'success' => true,
            'data' => ['purchaseOrders' => $purchaseOrders],
        ]);
    }

    /**
     * GET /batch-orders/{batchId} -> minimal HTML page (no auth, used for sharing).
     */
    public function batchPage(Request $request, string $batchId): \Illuminate\Http\Response
    {
        $safeBatchId = htmlspecialchars($batchId, ENT_QUOTES, 'UTF-8');
        $html = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1">'
            . '<title>PddTool Batch ' . $safeBatchId . '</title></head>'
            . '<body><h1>Batch Order</h1><p>Batch ID: ' . $safeBatchId . '</p>'
            . '</body></html>';

        return response($html, 200)->header('Content-Type', 'text/html; charset=utf-8');
    }

    /**
     * GET /link-converter  (public HTML)
     *
     * Hosted landing page for the order-link converter the extension opens in a browser tab.
     * The actual conversion runs through the authed POST /convert-order-link from the extension.
     */
    public function linkConverterPage(Request $request): \Illuminate\Http\Response
    {
        $html = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1">'
            . '<title>DingDuoDuo Link Converter</title><style>'
            . 'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f8fb;color:#222;margin:0;padding:24px}'
            . 'h1{font-size:20px;color:#1a73e8}p{color:#555;font-size:14px;line-height:1.6}'
            . '</style></head><body>'
            . '<h1>DingDuoDuo Order-Link Converter</h1>'
            . '<p>Paste a Pinduoduo order/share link in the extension to convert it to a mobile order link.</p>'
            . '</body></html>';

        return response($html, 200)->header('Content-Type', 'text/html; charset=utf-8');
    }

    /**
     * POST /convert-order-link {source_url, dd_info?} -> {success:true, mobile_url}
     *
     * Simple passthrough for now (returns the source url as the mobile url).
     */
    public function convertOrderLink(Request $request): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $sourceUrl = (string) $request->input('source_url', '');
        if ($sourceUrl === '') {
            return response()->json(['detail' => 'source_url is required'], 422);
        }

        // TODO: real PDD short-link -> mobile deep-link conversion. Passthrough for now.
        return response()->json([
            'success' => true,
            'mobile_url' => $sourceUrl,
        ]);
    }
}
