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

use App\Models\Group;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class GroupController
{
    public function index()
    {
        $groups = Group::orderBy('created_at', 'desc')
            ->withCount('configs')
            ->get();
        return response()->json($groups);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:groups',
            'description' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $group = Group::create([
            'name' => $request->name,
            'description' => $request->description
        ]);

        return response()->json($group, 201);
    }

    public function show(Group $group)
    {
        return response()->json($group->load('configs'));
    }

    public function update(Request $request, Group $group)
    {
        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('groups')->ignore($group->id)
            ],
            'description' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $group->update([
            'name' => $request->name,
            'description' => $request->description
        ]);

        return response()->json($group);
    }

    public function destroy(Group $group)
    {
        // Check whether the group has any associated configs
        if ($group->configs()->count() > 0) {
            return response()->json([
                'message' => 'Cannot delete group with associated configs'
            ], 422);
        }

        $group->delete();
        return response()->json(null, 204);
    }

    public function reorder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array',
            'ids.*' => 'exists:groups,id'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        Group::reorder($request->ids);

        return response()->json(['message' => 'Groups reordered successfully']);
    }
}
