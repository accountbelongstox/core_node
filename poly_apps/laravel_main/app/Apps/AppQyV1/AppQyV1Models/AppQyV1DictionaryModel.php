<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1DictionaryModel extends Model
{
    use HasFactory;

    /**
     * The database connection name for the model.
     *
     * @var string
     */
    protected $appKey = AppKeys::APPQYV1;

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
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('DICTIONARIES');
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
        $isTranslationField = AppQyV1TableMaps::getFieldName('DICTIONARIES', 'isTranslation');
        return self::where($isTranslationField, true)->count();
    }

    public static function countHasTranslation(){
        $translationField = AppQyV1TableMaps::getFieldName('DICTIONARIES', 'translation');
        return self::where($translationField, '!=', null)->count();
    }

    public function incrementQueryCount()
    {
        $queryCountField = AppQyV1TableMaps::getFieldName('DICTIONARIES', 'queryCount');
        $lastQueryTimeField = AppQyV1TableMaps::getFieldName('DICTIONARIES', 'lastQueryTime');
        
        $this->increment($queryCountField);
        $this->update([$lastQueryTimeField => now()]);
    }

    public static function findByContent($content)
    {
        $contentField = AppQyV1TableMaps::getFieldName('DICTIONARIES', 'content');
        return self::where($contentField, $content)->first();
    }

    public static function findByMd5($md5)
    {
        $md5Field = AppQyV1TableMaps::getFieldName('DICTIONARIES', 'md5');
        return self::where($md5Field, $md5)->first();
    }

    public static function findMissingEntries(array $contentArray): array
    {
        $contentField = AppQyV1TableMaps::getFieldName('DICTIONARIES', 'content');
        $existingEntries = self::whereIn($contentField, $contentArray)->pluck($contentField)->toArray();
        return array_diff($contentArray, $existingEntries);
    }
}

