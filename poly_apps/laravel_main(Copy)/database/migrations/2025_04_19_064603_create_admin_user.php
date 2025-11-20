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


use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use App\Apps\DictV1\Controllers\DictV1Public\DictV1WordGroupPublicController;
use App\Utils\StrTool;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $username = 'adminroot';
        $hasAdmin = DB::table('users')->where('username', $username)->first();
        if ($hasAdmin) {
            echo "Admin user already exists";
            $adminId = $hasAdmin->id;
        }else{
            $adminId = DB::table('users')->insertGetId([
                'nickname' => 'Administrator',
                'username' => $username,
                'rolelevel' => 1,
                'rolename' => 'admin',
                'email' => 'accountbelongstox@163.com',
                'email_verified_at' => now(),
                'password' => Hash::make('12345678'),
                'created_at' => now(),
                'updated_at' => now(),
                'user_token' => StrTool::genUserTokenByTimeAndUUID(),
            ]);
        }

        if ($adminId) {
            DictV1WordGroupPublicController::ensureDefaultGroupIfNotExist($adminId, $username);
        }else{
            echo "Failed to create admin user, but default group is created";
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};