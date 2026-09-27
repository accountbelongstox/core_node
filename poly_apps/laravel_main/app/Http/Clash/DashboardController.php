<?php

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
