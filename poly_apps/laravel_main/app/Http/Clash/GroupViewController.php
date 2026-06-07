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

use App\Models\Group;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GroupViewController
{
    public function index()
    {
        return view('groups.index');
    }

    public function list()
    {
        $groups = Group::orderBy('created_at', 'desc')
            ->withCount('configs')
            ->get();

        if ($groups->isEmpty()) {
            // Create the default group
            $defaultGroup = Group::create([
                'name' => 'Default Group'
            ]);
            $groups = collect([$defaultGroup]);
        }

        return response()->json($groups);
    }

    public function findGroup($identifier)
    {
        // First try to find by group name
        $group = Group::where('name', $identifier)->first();

        if (!$group) {
            // If not found, try to find by ID
            $group = is_numeric($identifier) ? Group::find($identifier) : null;
        }

        // If still not found, return the first group or create the default group
        if (!$group) {
            $group = Group::first() ?? Group::create(['name' => 'Default Group']);
        }

        return $group;
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $group = Group::create($validated);
        return response()->json($group, 201);
    }

    public function update(Request $request, Group $group)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string'
        ]);

        $group->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Group updated successfully',
            'group' => $group
        ]);
    }

    public function destroy(Group $group)
    {
        // Check if group has any configs
        if ($group->configs()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete group with existing configurations'
            ], 422);
        }

        $group->delete();

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