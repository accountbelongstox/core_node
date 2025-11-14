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


namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use App\Apps\DictV1\Utils\DictV1DatabaseBridge;

class Dictionary extends Model
{
    use HasFactory;

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
        $this->table = DictV1DatabaseBridge::getDictionariesTableName();
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
        $isTranslationField = DictV1DatabaseBridge::getFieldName('dict_v1_dictionaries', 'isTranslation');
        return self::where($isTranslationField, true)->count();
    }

    public static function countHasTranslation(){
        $translationField = DictV1DatabaseBridge::getFieldName('dict_v1_dictionaries', 'translation');
        return self::where($translationField, '!=', null)->count();
    }

    public static function countHasVoice(){
        $voiceFilesField = DictV1DatabaseBridge::getFieldName('dict_v1_dictionaries', 'voice_files');
        return self::where($voiceFilesField, '!=', null)->count();
    }
    /**
     * Increment the query count for this dictionary entry
     *
     * @return void
     */
    public function incrementQueryCount()
    {
        $this->queryCount += 1;
        $this->lastQueryTime = now();
        $this->save();
    }

    /**
     * Find a dictionary entry by content
     *
     * @param string $content
     * @return Dictionary|null
     */
    public static function findByContent($content)
    {
        $md5 = md5($content);
        return self::where('md5', $md5)->first();
    }

    /**
     * Find a dictionary entry by MD5 hash
     *
     * @param string $md5
     * @return Dictionary|null
     */
    public static function findByMd5($md5)
    {
        return self::where('md5', $md5)->first();
    }
    
    /**
     * Find dictionary entries that don't exist from an array of content strings
     *
     * @param array $contentArray Array of content strings to check
     * @return array Array of content strings that don't exist in the dictionary
     */
    public static function findMissingEntries(array $contentArray): array
    {
        if (empty($contentArray)) {
            return [];
        }
        
        // Calculate MD5 hashes for all contents
        $md5Hashes = array_map('md5', $contentArray);
        
        // Find existing entries by MD5 hashes
        $existingMd5s = DB::table('dict_v1_dictionaries')
            ->whereIn('md5', $md5Hashes)
            ->pluck('md5')
            ->toArray();
        
        // Create a lookup array for faster checking
        $existingMd5Lookup = array_flip($existingMd5s);
        
        // Find missing entries
        $missingEntries = [];
        
        foreach ($contentArray as $content) {
            $md5 = md5($content);
            
            if (!isset($existingMd5Lookup[$md5])) {
                $missingEntries[] = $content;
            }
        }
        
        return $missingEntries;
    }
} 