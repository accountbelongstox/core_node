<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;

class CodeMartV1ContactMessageModel extends CodeMartV1Model
{
    protected $table = CodeMartV1TablesMaps::CONTACT_MESSAGES_TABLE;

    protected $fillable = [
        'name',
        'email',
        'subject',
        'message',
        'status',
        'handled_by',
        'handled_at',
    ];

    protected $casts = [
        'handled_at' => 'datetime',
    ];
}
