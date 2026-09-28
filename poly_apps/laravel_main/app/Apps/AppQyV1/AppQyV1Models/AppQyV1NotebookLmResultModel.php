<?php

namespace App\Apps\AppQyV1\AppQyV1Models;


/**
 * NotebookLM answer record.
 *
 * One row per completed `notebooklm` global task. Written by
 * App\Services\TaskProcessors\NotebookLmTaskProcessor from the worker result
 * { answer?, notebook_url?, provider:'notebooklm' } plus the originating task's
 * payload { question|source_text, notebook_url?, title? }.
 */
class AppQyV1NotebookLmResultModel extends AppQyV1Model
{

    protected ?string $appTableSuffix = 'notebooklm_results';

    protected $fillable = [
        'task_id',
        'title',
        'question',
        'answer',
        'notebook_url',
        'provider',
    ];

}
