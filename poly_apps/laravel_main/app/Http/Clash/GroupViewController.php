<?php

namespace App\Http\Clash;

use App\Http\Controllers\Controller;

use App\Apps\ClashV1\ClashV1Models\ClashV1GroupModel as Group;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GroupViewController extends Controller
{
    public function index()
    {
        return view('groups.index');
    }

    public function list()
    {
        $groups = Group::orderedWithConfigCounts();

        if ($groups->isEmpty()) {
            // Create the default group
            $defaultGroup = Group::createGroup([
                'name' => 'Default Group'
            ]);
            $groups = collect([$defaultGroup]);
        }

        return response()->json($groups);
    }

    public function findGroup($identifier)
    {
        return Group::resolveOrDefault($identifier);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $group = Group::createGroup($validated);
        return response()->json($group, 201);
    }

    public function update(Request $request, Group $group)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string'
        ]);

        $group->updateRecord($validated);

        return response()->json([
            'success' => true,
            'message' => 'Group updated successfully',
            'group' => $group
        ]);
    }

    public function destroy(Group $group)
    {
        // Check if group has any configs
        if ($group->hasConfigs()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete group with existing configurations'
            ], 422);
        }

        $group->deleteRecord();

        return response()->json([
            'success' => true,
            'message' => 'Group deleted successfully'
        ]);
    }

    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:groups,id'
        ]);

        Group::reorder($validated['ids']);
        return response()->json(['message' => 'Groups reordered successfully']);
    }
} 
