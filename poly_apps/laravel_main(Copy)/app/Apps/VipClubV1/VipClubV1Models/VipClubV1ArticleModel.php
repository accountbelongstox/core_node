<?php

namespace App\Apps\VipClubV1\VipClubV1Models;

use Illuminate\Database\Eloquent\Model;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;

class VipClubV1ArticleModel extends Model
{
    protected $table;

    protected $fillable = [
        'title',
        'summary',
        'content',
        'category',
        'cover_image_url',
        'author',
        'publish_date',
        'read_count',
        'tags',
        'is_featured',
        'is_published'
    ];

    protected $casts = [
        'publish_date' => 'datetime',
        'tags' => 'array',
        'is_featured' => 'boolean',
        'is_published' => 'boolean',
        'read_count' => 'integer'
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->table = VipClubV1TablesMap::getTableName('ARTICLES');
    }

    public function scopePublished($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('ARTICLES', 'is_published'), true);
    }

    public function scopeFeatured($query)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('ARTICLES', 'is_featured'), true);
    }

    public function scopeByCategory($query, string $category)
    {
        return $query->where(VipClubV1TablesMap::getFieldName('ARTICLES', 'category'), $category);
    }

    public function scopeRecent($query)
    {
        return $query->orderBy(VipClubV1TablesMap::getFieldName('ARTICLES', 'publish_date'), 'desc');
    }

    public function incrementReadCount()
    {
        $readCountField = VipClubV1TablesMap::getFieldName('ARTICLES', 'read_count');
        $this->{$readCountField} = $this->{$readCountField} + 1;
        $this->save();
    }
}
