<?php

namespace App\Services\QueueCenter;

class DiffIdPageCatalog
{
    private DiffIdCursorStore $cursors;
    private DiffIdPageStore $pages;
    private LazyDataSegmentStore $segments;

    public function __construct()
    {
        $this->cursors = new DiffIdCursorStore();
        $this->pages = new DiffIdPageStore();
        $this->segments = new LazyDataSegmentStore();
    }

    public function discover(string $scope, object $idQuery, int $pageSize): array
    {
        $pageSize = max(1, min($pageSize, 1000));

        return $this->cursors->locked(
            $scope,
            function (array $state) use ($scope, $idQuery, $pageSize): array {
                if ($state === []) {
                    $snapshotMax = (int) ((clone $idQuery)->reorder()->max('id') ?? 0);
                    $state = [
                        'phase' => $snapshotMax > 0 ? 'snapshot' : 'incremental',
                        'snapshot_max_id' => $snapshotMax,
                        'discover_cursor' => 0,
                        'incremental_cursor' => $snapshotMax,
                        'page_count' => 0,
                        'consumed_page' => 0,
                    ];
                }

                $phase = (string) ($state['phase'] ?? 'snapshot');
                $cursor = $phase === 'snapshot'
                    ? (int) ($state['discover_cursor'] ?? 0)
                    : (int) ($state['incremental_cursor'] ?? 0);
                $upperBound = $phase === 'snapshot'
                    ? (int) ($state['snapshot_max_id'] ?? 0)
                    : (int) ((clone $idQuery)->reorder()->max('id') ?? 0);

                if ($upperBound <= $cursor) {
                    if ($phase === 'snapshot') {
                        $state['phase'] = 'incremental';
                        $state['incremental_cursor'] = max(
                            (int) ($state['incremental_cursor'] ?? 0),
                            (int) ($state['snapshot_max_id'] ?? 0)
                        );
                        $this->cursors->write($scope, $state);
                    }
                    return $this->result($scope, $state, []);
                }

                $ids = (clone $idQuery)
                    ->reorder()
                    ->where('id', '>', $cursor)
                    ->where('id', '<=', $upperBound)
                    ->orderBy('id')
                    ->limit($pageSize)
                    ->pluck('id')
                    ->map(static fn ($id): int => (int) $id)
                    ->all();

                if ($ids === []) {
                    if ($phase === 'snapshot') {
                        $state['phase'] = 'incremental';
                    }
                    $state['incremental_cursor'] = max(
                        (int) ($state['incremental_cursor'] ?? 0),
                        $upperBound
                    );
                    $this->cursors->write($scope, $state);
                    return $this->result($scope, $state, []);
                }

                $page = (int) ($state['page_count'] ?? 0) + 1;
                $lastId = (int) end($ids);
                $this->pages->write($scope, $page, $ids);
                $state['page_count'] = $page;
                if ($phase === 'snapshot') {
                    $state['discover_cursor'] = $lastId;
                    if ($lastId >= (int) ($state['snapshot_max_id'] ?? 0)) {
                        $state['phase'] = 'incremental';
                        $state['incremental_cursor'] = (int) ($state['snapshot_max_id'] ?? $lastId);
                    }
                } else {
                    $state['incremental_cursor'] = $lastId;
                }
                $this->cursors->write($scope, $state);

                return $this->result($scope, $state, $ids);
            }
        );
    }

    public function pendingPage(string $scope): array
    {
        $state = $this->cursors->read($scope);
        if ($state === []) {
            return ['page' => 0, 'ids' => []];
        }

        $page = (int) ($state['consumed_page'] ?? 0) + 1;
        if ($page > (int) ($state['page_count'] ?? 0)) {
            return ['page' => 0, 'ids' => []];
        }

        $ids = $this->pages->read($scope, $page);
        return [
            'page' => $page,
            'ids' => array_map('intval', $ids),
        ];
    }

    public function acknowledge(string $scope, int $page): void
    {
        $this->cursors->locked(
            $scope,
            function (array $state) use ($scope, $page): void {
                if ($state === []) {
                    return;
                }
                $expected = (int) ($state['consumed_page'] ?? 0) + 1;
                if ($page === $expected) {
                    $state['consumed_page'] = $page;
                    $this->cursors->write($scope, $state);
                    $this->pages->pruneConsumed($scope, $page);
                }
            }
        );
    }

    public function materialize(
        string $scope,
        int|string $segment,
        array $ids,
        callable $loader
    ): array
    {
        return $this->segments->materialize($scope, $segment, $ids, $loader);
    }

    public function consume(string $scope, int $page, array $ids): void
    {
        $this->acknowledge($scope, $page);
        $this->segments->consume($scope, $page, $ids);
    }

    public function promote(string $scope, int|string $id): void
    {
        $this->cursors->touch($scope, $id);
        $this->pages->promote($scope, $id);
    }

    public function snapshotPage(
        string $scope,
        int $page,
        object $idQuery,
        string $idColumn = 'id'
    ): array {
        $state = $this->cursors->read($scope);
        $revision = (int) ($state['revision'] ?? 0);
        $segment = 'view:' . $revision . ':' . max(1, $page);
        $ids = (clone $idQuery)->pluck($idColumn)->all();
        $this->pages->writeTemporary($scope, $segment, $ids);

        return [
            'segment' => $segment,
            'revision' => $revision,
            'ids' => $ids,
        ];
    }

    public function compactSegment(string $scope, int|string $segment, array $ids): void
    {
        $this->segments->consume($scope, $segment, $ids);
    }

    /**
     * Priority-promoted head IDs for one scope (rule 3: promotion only touches
     * the cursor/head page, never full rows).
     */
    public function headIds(string $scope): array
    {
        return $this->pages->read($scope, 'head');
    }

    private function result(string $scope, array $state, array $ids): array
    {
        return [
            'scope' => $scope,
            'phase' => (string) ($state['phase'] ?? 'incremental'),
            'page' => (int) ($state['page_count'] ?? 0),
            'ids' => $ids,
            'cataloged' => count($ids),
            'pending_pages' => max(
                0,
                (int) ($state['page_count'] ?? 0) - (int) ($state['consumed_page'] ?? 0)
            ),
        ];
    }

}
