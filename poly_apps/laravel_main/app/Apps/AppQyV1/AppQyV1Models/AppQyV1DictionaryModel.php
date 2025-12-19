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

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

class AppQyV1DictionaryModel extends Model
{
    use HasFactory;

    /**
     * The database connection name for the model.
     *
     * @var string
     */
    protected $connection = 'appqyv1';

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table;

    /**
     * Constructor to set table name from database bridge
     */
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->table = AppQyV1TableMaps::getTableName('app_qy_v1_DICTIONARIES');
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'content',
        'md5',
        'translation',
        'isTranslation',
        'translation_provider',
        'usPhonetic',
        'ukPhonetic',
        'voice_files',
        'image_files',
        'isExistLocal',
        'voice_files_provider',
        'image_files_provider',
        'hasOperations',
        'queryCount',
        'lastModified',
        'lastInsertTime',
        'lastUpdateTime',
        'lastQueryTime',
        'createdAt'
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'translation' => 'json',
        'voice_files' => 'json',
        'image_files' => 'json',
        'isTranslation' => 'boolean',
        'isExistLocal' => 'boolean',
        'hasOperations' => 'boolean',
        'lastModified' => 'datetime',
        'lastInsertTime' => 'datetime',
        'lastUpdateTime' => 'datetime',
        'lastQueryTime' => 'datetime',
        'createdAt' => 'datetime',
    ];

    public static function countAll(){
        return self::count();
    }

    public static function countByTranslation(){
        $isTranslationField = AppQyV1TableMaps::getFieldName('app_qy_v1_DICTIONARIES', 'isTranslation');
        return self::where($isTranslationField, true)->count();
    }

    public static function countHasTranslation(){
        $translationField = AppQyV1TableMaps::getFieldName('app_qy_v1_DICTIONARIES', 'translation');
        return self::where($translationField, '!=', null)->count();
    }

    public function incrementQueryCount()
    {
        $queryCountField = AppQyV1TableMaps::getFieldName('app_qy_v1_DICTIONARIES', 'queryCount');
        $lastQueryTimeField = AppQyV1TableMaps::getFieldName('app_qy_v1_DICTIONARIES', 'lastQueryTime');
        
        $this->increment($queryCountField);
        $this->update([$lastQueryTimeField => now()]);
    }

    public static function findByContent($content)
    {
        $contentField = AppQyV1TableMaps::getFieldName('app_qy_v1_DICTIONARIES', 'content');
        return self::where($contentField, $content)->first();
    }

    public static function findByMd5($md5)
    {
        $md5Field = AppQyV1TableMaps::getFieldName('app_qy_v1_DICTIONARIES', 'md5');
        return self::where($md5Field, $md5)->first();
    }

    public static function findMissingEntries(array $contentArray): array
    {
        $contentField = AppQyV1TableMaps::getFieldName('app_qy_v1_DICTIONARIES', 'content');
        $existingEntries = self::whereIn($contentField, $contentArray)->pluck($contentField)->toArray();
        return array_diff($contentArray, $existingEntries);
    }
}

