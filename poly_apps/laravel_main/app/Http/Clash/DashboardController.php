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

class DashboardController
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
            : Group::first() ?? Group::create(['name' => 'Default Group']);

        return view('dashboard', compact('currentGroup'));
    }

    public function profile()
    {
        return view('profile.edit');
    }
}
