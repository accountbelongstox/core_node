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

use App\Http\Controllers\Controller;

use App\Apps\ClashV1\ClashV1Models\ClashV1GroupModel as Group;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct()
    {
        // Removed middleware setup in the constructor since it is already configured in the routes
    }

    public function index(Request $request)
    {
        // Get the group identifier (can be a name or ID)
        $groupIdentifier = $request->query('group');

        // Use GroupViewController to look up the group
        $groupViewController = new GroupViewController();
        $currentGroup = $groupIdentifier 
            ? $groupViewController->findGroup($groupIdentifier)
            : Group::defaultGroup();

        return view('dashboard', compact('currentGroup'));
    }

    public function profile()
    {
        return view('profile.edit');
    }
}
