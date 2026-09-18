<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;
use Illuminate\Support\Collection;

class CodeMartV1TestimonialModel extends CodeMartV1Model
{
    protected $table = CodeMartV1TablesMaps::TESTIMONIALS_TABLE;

    protected $fillable = [
        'quote_key',
        'author_label',
        'role_label',
        'avatar_url',
        'approved',
        'display_order',
    ];

    protected $casts = [
        'approved' => 'boolean',
    ];

    public static function approvedList(): Collection
    {
        return static::query()
            ->where('approved', true)
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();
    }
}
