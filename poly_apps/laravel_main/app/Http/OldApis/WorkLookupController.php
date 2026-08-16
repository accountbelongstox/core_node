<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\OldApis;

use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

class WorkLookupController extends Controller
{
    /**
     * Display the work lookup page.
     *
     * @return \Illuminate\View\View
     */
    public function index()
    {
        return view('work-lookup');
    }

    /**
     * Search for work items based on the given criteria.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\View\View
     */
    public function search(Request $request)
    {
        // Validate the request
        $validated = $request->validate([
            'search' => 'nullable|string|max:255',
            'category' => 'nullable|string|in:development,design,marketing,other',
            'status' => 'nullable|string|in:open,in_progress,completed',
        ]);

        // For now, return to the same view with empty results
        // TODO: Implement actual search functionality when database structure is ready
        return view('work-lookup', [
            'searchTerm' => $validated['search'] ?? '',
            'selectedCategory' => $validated['category'] ?? '',
            'selectedStatus' => $validated['status'] ?? '',
            'results' => [],
        ]);
    }
} 