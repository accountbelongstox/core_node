<?php

namespace App\Utils;

use Closure;

trait RunsModelTransactions
{
    public static function beginModelTransaction(): void
    {
        $model = new static();

        $model->getConnection()->beginTransaction();
    }

    public static function commitModelTransaction(): void
    {
        $model = new static();

        $model->getConnection()->commit();
    }

    public static function rollBackModelTransaction(): void
    {
        $model = new static();

        $model->getConnection()->rollBack();
    }

    public static function runInTransaction(Closure $callback): mixed
    {
        $model = new static();

        return $model->getConnection()->transaction($callback);
    }
}
