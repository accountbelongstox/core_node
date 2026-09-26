<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
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
        'quotes',
        'role_labels',
        'status',
        'user_id',
        'project_id',
        'moderated_by',
        'moderated_at',
    ];

    protected $casts = [
        'approved' => 'boolean',
        'quotes' => 'json',
        'role_labels' => 'json',
        'moderated_at' => 'datetime',
    ];

    public static function approvedList(): Collection
    {
        return static::query()
            ->where('approved', true)
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();
    }

    /**
     * Rows created before moderation status existed carry only the approved
     * flag; the flag stays authoritative for them.
     */
    public function effectiveStatus(): string
    {
        if ($this->approved) {
            return CodeMartV1Constants::TESTIMONIAL_STATUS_APPROVED;
        }

        return $this->status === CodeMartV1Constants::TESTIMONIAL_STATUS_HIDDEN
            ? CodeMartV1Constants::TESTIMONIAL_STATUS_HIDDEN
            : CodeMartV1Constants::TESTIMONIAL_STATUS_PENDING;
    }

    public function quoteForLocale(string $locale): ?string
    {
        return self::pickLocalized($this->quotes, $locale) ?? ($this->quote_key !== '' ? $this->quote_key : null);
    }

    public function roleLabelForLocale(string $locale): ?string
    {
        return self::pickLocalized($this->role_labels, $locale) ?? $this->role_label;
    }

    private static function pickLocalized(mixed $values, string $locale): ?string
    {
        if (!is_array($values) || $values === []) {
            return null;
        }

        foreach ([$locale, CodeMartV1Constants::DEFAULT_LOCALE] as $candidate) {
            if (isset($values[$candidate]) && is_string($values[$candidate]) && trim($values[$candidate]) !== '') {
                return $values[$candidate];
            }
        }

        foreach ($values as $value) {
            if (is_string($value) && trim($value) !== '') {
                return $value;
            }
        }

        return null;
    }
}
