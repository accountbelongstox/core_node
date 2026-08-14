<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\Clash;

use App\Apps\ClashV1\ClashV1Models\ClashV1ConfigModel as ClashUrlsConfig;
use App\Apps\ClashV1\ClashV1Models\ClashV1GroupModel as Group;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ConfigController
{
    public function index($groupId)
    {
        $configs = ClashUrlsConfig::forGroup((int) $groupId)
            ->map(function ($config) {
                // Calculate the remaining months
                $expiryMonths = 0;
                if ($config->expires_at) {
                    $now = Carbon::now();
                    $expiryDate = Carbon::parse($config->expires_at);
                    if ($expiryDate->gt($now)) {
                        $expiryMonths = $now->diffInMonths($expiryDate);
                        if ($expiryMonths > 6) {
                            $expiryMonths = 6;
                        } else if ($expiryMonths > 2) {
                            $expiryMonths = 6;
                        } else if ($expiryMonths > 1) {
                            $expiryMonths = 2;
                        } else {
                            $expiryMonths = 1;
                        }
                    }
                }

                return [
                    'group_id' => $config->group_id,
                    'id' => $config->id,
                    'type' => $config->type,
                    'content' => $config->content,
                    'md5' => $config->md5,
                    'expires_at' => $config->expires_at ? $config->expires_at->format('Y-m-d H:i:s') : null,
                    'expiry_months' => $config->expires_at ? $expiryMonths : 0,
                    'created_at' => $config->created_at->format('Y-m-d H:i:s')
                ];
            });

        return response()->json($configs);
    }

    public function store(Request $request)
    {
        $request->validate([
            'type' => 'required|string',
            'content' => 'required|string',
            'expiry_months' => 'required|integer|in:1,2,6,0',
        ]);

        // Check if content already exists
        if (ClashUrlsConfig::contentExists($request->content)) {
            return response()->json([
                'success' => false,
                'message' => 'Configuration with this content already exists'
            ], 422);
        }

        $expiryDate = null;
        if ((int)$request->expiry_months > 0) {
            $expiryDate = Carbon::now()->addMonths((int)$request->expiry_months);
        }

        $config = new ClashUrlsConfig();
        $config->group_id = $request->group_id;
        $config->type = $request->type;
        $config->md5 = md5($request->content);
        $config->content = $request->content;
        $config->expires_at = $expiryDate;
        $config->saveRecord();

        return response()->json([
            'success' => true,
            'message' => 'Configuration added successfully',
            'config' => $config
        ]);
    }

    public function update(Request $request, ClashUrlsConfig $config)
    {
        $request->validate([
            'type' => 'required|string',
            'content' => 'required|string',
            'expiry_months' => 'required|integer|in:1,2,6,0',
            'group_id' => 'required|exists:groups,id'
        ]);

        $expiryDate = null;
        if ((int)$request->expiry_months > 0) {
            $expiryDate = Carbon::now()->addMonths((int)$request->expiry_months);
        }

        $config->type = $request->type;
        $config->group_id = $request->group_id;
        $config->md5 = md5($request->content);
        $config->content = $request->content;
        $config->expires_at = $expiryDate;
        $config->saveRecord();

        return response()->json([
            'success' => true,
            'message' => 'Configuration updated successfully',
            'config' => $config
        ]);
    }

    public function destroy(ClashUrlsConfig $config)
    {
        $config->deleteRecord();

        return response()->json([
            'success' => true,
            'message' => 'Configuration deleted successfully'
        ]);
    }
} 
