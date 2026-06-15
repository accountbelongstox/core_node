<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Models;


use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Apps\DictV1\Utils\DictV1DatabaseBridge;

class WordGroup extends Model
{
    use HasFactory, SoftDeletes;

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
        $this->table = DictV1DatabaseBridge::getWordGroupsTableName();
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'gid',
        'uid',
        'gname',
        'gcontent',
        'gwords',
        'words_frequency',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'gwords' => 'array',
        'words_frequency' => 'array',
    ];

    /**
     * Get the user that owns the word group.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'uid');
    }

    /**
     * Get words array from gwords text field
     *
     * @return array
     */
    public function getWordsArray() : array | string
    {
        if (empty($this->gwords)) {
            return [];
        }
        return $this->gwords;       
    }


    /**
     * Add words to already read words
     *
     * @param array|string $words
     * @return void
     */
    public function addToWordsFrequency($words): void
    {
        $currentWords = $this->words_frequency ?? [];
        $newWords = is_array($words) ? $words : explode(',', $words);
        $this->words_frequency = array_values(array_unique(array_merge($currentWords, array_filter(array_map('trim', $newWords)))));
    }


    /**
     * Remove words from words frequency
     *
     * @param array|string $words
     * @return void
     */
    public function removeFromWordsFrequency($words): void
    {
        $currentWords = $this->words_frequency ?? [];
        $removeWords = is_array($words) ? $words : explode(',', $words);
        $this->words_frequency = array_values(array_diff($currentWords, array_filter(array_map('trim', $removeWords))));
    }
}
