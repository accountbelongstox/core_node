<?php

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