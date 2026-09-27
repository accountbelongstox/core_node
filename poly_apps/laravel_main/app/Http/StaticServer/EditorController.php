<?php

namespace App\Http\StaticServer;

use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

class EditorController extends Controller
{
    public function single()
    {
        return view('editor.single');
    }

    public function multi()
    {
        return view('editor.multi');
    }

    public function diff()
    {
        return view('editor.diff');
    }
} 