<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\Clash;

use App\Models\ClashUrlsConfig;
use App\Models\Group;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ConfigController
{
    public function index($groupId)
    {
        $configs = ClashUrlsConfig::where('group_id', $groupId)
            ->orderBy('created_at', 'desc')
            ->get()
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
        if (ClashUrlsConfig::where('content', $request->content)->exists()) {
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
        $config->save();

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
        $config->save();

        return response()->json([
            'success' => true,
            'message' => 'Configuration updated successfully',
            'config' => $config
        ]);
    }

    public function destroy(ClashUrlsConfig $config)
    {
        $config->delete();

        return response()->json([
            'success' => true,
            'message' => 'Configuration deleted successfully'
        ]);
    }
} 