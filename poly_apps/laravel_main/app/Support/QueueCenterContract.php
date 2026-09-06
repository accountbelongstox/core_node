<?php

namespace App\Support;

use DateTimeInterface;
use RuntimeException;

/**
 * Laravel adapter for the canonical Queue Center and distributed-task contract.
 *
 * Source: config/queue_center_contract.json
 * Aligned adapters:
 * - pycore/pyutils/common/queue_center_contract.py
 * - poly_apps/pycore_laravel_wordnew_ui/core/contracts/QueueCenterContract.ts
 * - apps/mcp-chrome/app/chrome-extension/utils/queue-center-contract.ts
 *
 * A task status, lane, capability, priority, task-type route, or wire field must
 * be changed in the JSON source first. The other adapters read the same file;
 * no controller, worker, or UI may maintain a second vocabulary.
 */
final class QueueCenterContract
{
    private static ?array $document = null;
    private static ?array $taskTypeIndex = null;

    public static function document(): array
    {
        if (self::$document !== null) {
            return self::$document;
        }

        $path = dirname(dirname(base_path())).DIRECTORY_SEPARATOR.'config'.DIRECTORY_SEPARATOR.'queue_center_contract.json';
        $json = file_get_contents($path);
        $document = is_string($json) ? json_decode($json, true) : null;
        if (!is_array($document)) {
            throw new RuntimeException("Unable to load Queue Center contract: {$path}");
        }
        self::assertTaskTypeContract($document);

        self::$document = $document;
        return self::$document;
    }

    private static function assertTaskTypeContract(array $document): void
    {
        $names = [];
        $definitions = $document['task_contract']['task_types'] ?? [];
        foreach ($definitions as $definition) {
            $key = strtolower(trim((string) ($definition['key'] ?? '')));
            $ordering = $definition['ordering'] ?? null;
            if ($key === '' || !in_array($ordering, ['queue_position', 'priority'], true)) {
                throw new RuntimeException("Queue Center task type has invalid ordering: {$key}");
            }
            foreach (($definition['language_priority'] ?? []) as $language) {
                $normalized = strtolower(trim((string) $language));
                if ($normalized === '' || $normalized !== (string) $language) {
                    throw new RuntimeException("Queue Center task type has invalid language_priority: {$key}");
                }
            }
            $aliases = is_array($definition['aliases'] ?? null) ? $definition['aliases'] : [];
            foreach (array_merge([$key], $aliases) as $name) {
                $normalized = strtolower(trim((string) $name));
                if ($normalized === '' || isset($names[$normalized])) {
                    throw new RuntimeException("Queue Center task type name is duplicated: {$normalized}");
                }
                $names[$normalized] = $definition;
            }
        }
        self::$taskTypeIndex = $names;
    }

    public static function schemaVersion(): int
    {
        return (int) (self::document()['schema_version'] ?? 0);
    }

    public static function controlNames(): array
    {
        return array_values(self::document()['control_names'] ?? []);
    }

    public static function diffDelivery(): array
    {
        return self::document()['diff_delivery'] ?? [];
    }

    public static function httpTransfer(): array
    {
        return self::document()['http_transfer'] ?? [];
    }

    /**
     * Word-validity verification defaults (batch size, default languages, the
     * validity_source marker written for AI-verified rows, and browser request
     * timing for the shared worker lane).
     */
    public static function wordValidity(): array
    {
        return self::document()['word_validity'] ?? [];
    }

    public static function wordValidityBatchSize(): int
    {
        return (int) (self::wordValidity()['batch_size'] ?? 20);
    }

    public static function wordValidityViewPageSize(): int
    {
        return (int) (self::wordValidity()['view_page_size'] ?? 1000);
    }

    public static function wordValidityRequestTimeoutSeconds(): int
    {
        $milliseconds = (int) (self::wordValidity()['request_timeout_ms'] ?? 120000);

        return max(10, (int) ceil($milliseconds / 1000));
    }

    public static function wordValiditySourceMarker(): string
    {
        return (string) (self::wordValidity()['source_marker'] ?? 'ai_ensure');
    }

    /**
     * Contract-owned endpoint path templates (worker + queue-center plane).
     * Laravel registers these routes; the other three ends render the same
     * paths from this block, so a route change starts here.
     */
    public static function endpoints(): array
    {
        return self::document()['endpoints'] ?? [];
    }

    /**
     * Render one endpoint path; {token} segments are percent-encoded here.
     */
    public static function endpoint(string $role, array $tokens = []): string
    {
        $template = self::endpoints()[$role] ?? null;
        if (!is_string($template) || $template === '') {
            throw new RuntimeException("Unknown Queue Center endpoint role: {$role}");
        }
        foreach ($tokens as $key => $value) {
            $template = str_replace('{' . $key . '}', rawurlencode((string) $value), $template);
        }
        return $template;
    }

    public static function consumerSliceLimit(string $taskType): int
    {
        $delivery = self::diffDelivery();
        $limits = is_array($delivery['consumer_batch_limits'] ?? null)
            ? $delivery['consumer_batch_limits']
            : [];

        return max(1, (int) (
            $limits[$taskType]
            ?? $delivery['consumer_slice_default']
            ?? self::taskLimit('worker_pull_default')
        ));
    }

    public static function deliveryReceipt(): array
    {
        return self::document()['delivery_receipt'] ?? [];
    }

    public static function deliveryReceiptStage(string $role): string
    {
        $stages = self::deliveryReceipt()['stages'] ?? [];
        if (!array_key_exists($role, $stages)) {
            throw new RuntimeException("Unknown delivery receipt stage: {$role}");
        }
        return (string) $stages[$role];
    }

    public static function realtime(): array
    {
        return self::document()['realtime'] ?? [];
    }

    public static function realtimeEvents(): array
    {
        return array_values(self::realtime()['events'] ?? []);
    }

    /**
     * Relay transport contract (Mercure wake/control topics + data-plane
     * HTTP store-and-fetch + capability-provider declarations). Every end
     * (Laravel, pycore, the UIs) renders topics, update types, TTLs, and
     * caps from this block; no end hardcodes a relay vocabulary.
     */
    public static function relay(): array
    {
        return self::document()['relay'] ?? [];
    }

    public static function relayTopic(string $role, array $tokens = []): string
    {
        $topics = self::relay()['topics'] ?? [];
        $template = $topics[$role] ?? null;
        if (!is_string($template) || $template === '') {
            throw new RuntimeException("Unknown relay topic role: {$role}");
        }
        foreach ($tokens as $key => $value) {
            $template = str_replace('{' . $key . '}', (string) $value, $template);
        }
        return $template;
    }

    public static function relayEvent(string $role): string
    {
        $events = self::relay()['events'] ?? [];
        if (!array_key_exists($role, $events)) {
            throw new RuntimeException("Unknown relay event role: {$role}");
        }
        return (string) $events[$role];
    }

    /**
     * Mercure hub block: protocol and well-known subscription path.
     */
    public static function relayHub(): array
    {
        return self::relay()['hub'] ?? [];
    }

    public static function relayHubString(string $key): string
    {
        $value = self::relayHub()[$key] ?? null;
        if (!is_string($value) || $value === '') {
            throw new RuntimeException("Unknown relay hub string setting: {$key}");
        }
        return $value;
    }

    public static function relayHubInt(string $key): int
    {
        $value = self::relayHub()[$key] ?? null;
        if (!is_int($value)) {
            throw new RuntimeException("Unknown relay hub integer setting: {$key}");
        }
        return $value;
    }

    public static function relayHubBool(string $key): bool
    {
        $value = self::relayHub()[$key] ?? null;
        if (!is_bool($value)) {
            throw new RuntimeException("Unknown relay hub boolean setting: {$key}");
        }
        return $value;
    }

    public static function relayInt(string $key): int
    {
        $value = self::relay()[$key] ?? null;
        if (!is_int($value)) {
            throw new RuntimeException("Unknown relay integer setting: {$key}");
        }
        return $value;
    }

    public static function relayCap(string $key): int
    {
        $caps = self::relay()['caps'] ?? [];
        if (!isset($caps[$key]) || !is_int($caps[$key])) {
            throw new RuntimeException("Unknown relay cap: {$key}");
        }
        return $caps[$key];
    }

    /**
     * Declared capability providers (1.8): pycore is implemented; the other
     * groups (laravel-manager, wordnew, mcp-chrome) are declaration-only.
     */
    public static function relayCapabilityProviders(): array
    {
        return self::relay()['capability_providers'] ?? [];
    }

    public static function queueMetricDefaults(): array
    {
        return self::document()['section_contract_defaults']['queue'] ?? [];
    }

    public static function sections(): array
    {
        return self::document()['section_scopes'] ?? [];
    }

    public static function categories(): array
    {
        return array_values(self::document()['categories'] ?? []);
    }

    public static function taskContract(): array
    {
        return self::document()['task_contract'] ?? [];
    }

    public static function taskStatuses(string $group = 'all'): array
    {
        $statusContract = self::taskContract()['statuses'] ?? [];
        $values = $statusContract['values'] ?? [];
        return array_values(array_map(
            static fn (string $role): string => (string) ($values[$role] ?? $role),
            $statusContract[$group] ?? []
        ));
    }

    public static function taskStatus(string $role): string
    {
        $values = self::taskContract()['statuses']['values'] ?? [];
        if (!array_key_exists($role, $values)) {
            throw new RuntimeException("Unknown global-task status role: {$role}");
        }
        return (string) $values[$role];
    }

    public static function taskEvent(string $role): string
    {
        $values = self::taskContract()['events']['values'] ?? [];
        if (!array_key_exists($role, $values)) {
            throw new RuntimeException("Unknown global-task event role: {$role}");
        }
        return (string) $values[$role];
    }

    public static function taskEvents(string $group = 'terminal'): array
    {
        $events = self::taskContract()['events'] ?? [];
        $values = $events['values'] ?? [];
        return array_values(array_map(
            static fn (string $role): string => (string) ($values[$role] ?? $role),
            $events[$group] ?? []
        ));
    }

    public static function taskStreamEvent(string $role): string
    {
        $events = self::taskContract()['stream_events'] ?? [];
        if (!array_key_exists($role, $events)) {
            throw new RuntimeException("Unknown global-task stream event role: {$role}");
        }
        return (string) $events[$role];
    }

    public static function taskExecutionTypes(): array
    {
        return array_values(self::taskContract()['execution_types'] ?? []);
    }

    public static function taskExecutionType(string $role): string
    {
        $types = self::taskContract()['execution_types'] ?? [];
        if (!array_key_exists($role, $types)) {
            throw new RuntimeException("Unknown global-task execution role: {$role}");
        }
        return (string) $types[$role];
    }

    public static function taskCapabilities(): array
    {
        return array_values(array_keys(self::document()['capability_claimants'] ?? []));
    }

    public static function taskPriority(string $name): int
    {
        $priorities = self::taskContract()['priorities'] ?? [];
        if (!array_key_exists($name, $priorities)) {
            throw new RuntimeException("Unknown global-task priority: {$name}");
        }
        return (int) $priorities[$name];
    }

    public static function taskProgressStage(string $name): int
    {
        $stages = self::taskContract()['progress_stages'] ?? [];
        if (!array_key_exists($name, $stages)) {
            throw new RuntimeException("Unknown global-task progress stage: {$name}");
        }
        return (int) $stages[$name];
    }

    public static function taskLimit(string $name): int
    {
        $limits = self::taskContract()['limits'] ?? [];
        if (!array_key_exists($name, $limits)) {
            throw new RuntimeException("Unknown global-task limit: {$name}");
        }
        return (int) $limits[$name];
    }

    public static function capabilitySingleLanes(): array
    {
        return self::taskContract()['capability_single_lanes'] ?? [];
    }

    public static function fastLaneCapabilities(): array
    {
        return array_values(self::taskContract()['fast_lane_capabilities'] ?? []);
    }

    public static function taskTypes(): array
    {
        return array_values(self::taskContract()['task_types'] ?? []);
    }

    public static function taskTypeKeys(): array
    {
        return array_values(array_map(
            static fn (array $definition): string => (string) $definition['key'],
            self::taskTypes()
        ));
    }

    public static function taskTypeDefinition(string $taskType): ?array
    {
        $taskType = strtolower(trim($taskType));
        self::document();

        return self::$taskTypeIndex[$taskType] ?? null;
    }

    public static function taskTypeKey(string $role): ?string
    {
        $definition = self::taskTypeDefinition($role);
        $value = is_array($definition) ? ($definition['key'] ?? null) : null;
        return is_string($value) && $value !== '' ? $value : null;
    }

    public static function taskTypeExecution(string $taskType): ?string
    {
        $value = self::taskTypeDefinition($taskType)['execution_type'] ?? null;
        return is_string($value) && $value !== '' ? $value : null;
    }

    public static function taskTypeCapability(string $taskType): ?string
    {
        $value = self::taskTypeDefinition($taskType)['capability'] ?? null;
        return is_string($value) && $value !== '' ? $value : null;
    }

    public static function taskTypeClaimants(string $taskType): array
    {
        $definition = self::taskTypeDefinition($taskType);
        if ($definition === null) {
            return [];
        }
        if (is_array($definition['claimants'] ?? null)) {
            return array_values($definition['claimants']);
        }
        $capability = $definition['capability'] ?? null;
        return is_string($capability)
            ? array_values(self::document()['capability_claimants'][$capability] ?? [])
            : [];
    }

    /**
     * Single ordering authority for every end: a task type either orders by
     * Laravel-owned `queue_position` (Queue Center audio lanes) or by the
     * contract-defined numeric `priority`. Never branch on literal task-type
     * lists outside this method.
     */
    public static function taskOrdering(string $taskType): string
    {
        $definition = self::taskTypeDefinition($taskType);
        if ($definition === null) {
            return 'priority';
        }
        $ordering = $definition['ordering'] ?? null;
        if (!in_array($ordering, ['queue_position', 'priority'], true)) {
            throw new RuntimeException("Queue Center task type has invalid ordering: {$taskType}");
        }
        return (string) $ordering;
    }

    public static function isQueuePositionOrdered(string $taskType): bool
    {
        return self::taskOrdering($taskType) === 'queue_position';
    }

    /**
     * Language priority tiers for a task type (empty = no tiering). A lane
     * with tiers completes EVERY task of the first tier before any task of a
     * later tier, ahead of the lane's queue_position/priority ordering.
     * Pure contract data; the SQL lives in the model query concern
     * (GlobalTaskQueueQueries), which is the only place allowed to touch the
     * database.
     */
    public static function taskLanguagePriority(string $taskType): array
    {
        $definition = self::taskTypeDefinition($taskType);
        $tiers = is_array($definition['language_priority'] ?? null) ? $definition['language_priority'] : [];
        return array_values(array_filter(
            array_map(static fn ($language): string => strtolower(trim((string) $language)), $tiers),
            static fn (string $language): bool => $language !== ''
        ));
    }

    public static function queuePositionOrderedTaskTypes(): array
    {
        return array_values(array_map(
            static fn (array $definition): string => (string) $definition['key'],
            array_filter(
                self::taskTypes(),
                static fn (array $definition): bool => ($definition['ordering'] ?? null) === 'queue_position'
            )
        ));
    }

    public static function queuePositionOrderedTaskAliases(): array
    {
        $aliases = [];
        foreach (self::taskTypes() as $definition) {
            if (($definition['ordering'] ?? null) !== 'queue_position') {
                continue;
            }
            foreach (($definition['aliases'] ?? []) as $alias) {
                $aliases[] = (string) $alias;
            }
        }
        return array_values(array_unique($aliases));
    }

    public static function queuePositionOrderedControlNames(): array
    {
        return array_values(array_filter(
            self::controlNames(),
            static fn (string $taskType): bool => self::isQueuePositionOrdered($taskType)
        ));
    }

    public static function taskHistoryFilter(string $bucket): array
    {
        $history = self::taskContract()['history_buckets'] ?? [];
        $exact = [$bucket];
        $definition = self::taskTypeDefinition($bucket);
        if ($definition !== null) {
            $exact = array_merge($exact, $definition['aliases'] ?? []);
        }
        foreach (($history['exact_aliases'] ?? []) as $taskType => $aliasBucket) {
            if ($aliasBucket === $bucket) {
                $exact[] = (string) $taskType;
            }
        }
        $tokenRules = array_values(array_filter(
            $history['token_rules'] ?? [],
            static fn (array $rule): bool => ($rule['bucket'] ?? null) === $bucket
        ));
        return [
            'exact' => array_values(array_unique($exact)),
            'token_rules' => $tokenRules,
        ];
    }

    public static function taskOrderValue($task): int
    {
        $taskType = (string) (is_array($task) ? ($task['task_type'] ?? '') : ($task->task_type ?? ''));
        $field = self::taskOrdering($taskType);
        return (int) (is_array($task) ? ($task[$field] ?? 0) : ($task->{$field} ?? 0));
    }

    public static function compareTasks($left, $right): int
    {
        return self::taskOrderValue($right) <=> self::taskOrderValue($left);
    }

    public static function taskTypePromptPayloadField(string $taskType): string
    {
        $value = self::taskTypeDefinition($taskType)['prompt_payload_field'] ?? 'question';
        return is_string($value) && $value !== '' ? $value : 'question';
    }

    public static function taskPromptPayloadText(string $taskType, array $payload): ?string
    {
        $fields = array_values(array_unique([
            self::taskTypePromptPayloadField($taskType),
            'text',
            'source_text',
            'question',
            'prompt',
        ]));
        foreach ($fields as $field) {
            $value = $payload[$field] ?? null;
            if (is_string($value) && trim($value) !== '') {
                return $value;
            }
        }
        return null;
    }

    public static function interactiveTaskTypes(): array
    {
        return array_values(array_map(
            static fn (array $definition): string => (string) $definition['key'],
            array_filter(
                self::taskTypes(),
                static fn (array $definition): bool => ($definition['interactive'] ?? false) === true
            )
        ));
    }

    public static function fastPromotableTaskTypes(): array
    {
        return array_values(array_map(
            static fn (array $definition): string => (string) $definition['key'],
            array_filter(
                self::taskTypes(),
                static fn (array $definition): bool => ($definition['fast_promotable'] ?? false) === true
            )
        ));
    }

    public static function taskWireShape(string $shape): array
    {
        $shapes = self::taskContract()['wire_shapes'] ?? [];
        if (!array_key_exists($shape, $shapes)) {
            throw new RuntimeException("Unknown global-task wire shape: {$shape}");
        }
        return array_values($shapes[$shape]);
    }

    /**
     * Project an Eloquent model or array onto a centrally declared wire shape.
     * This is the backend base serializer shared by list, worker-pull, and detail
     * responses. Adding a field starts in config/queue_center_contract.json and
     * then becomes visible to every adapter without another field list.
     */
    public static function projectTask($task, string $shape): array
    {
        $record = [];
        $taskType = (string) (is_array($task) ? ($task['task_type'] ?? '') : ($task->task_type ?? ''));
        $usesQueuePosition = self::isQueuePositionOrdered($taskType);
        foreach (self::taskWireShape($shape) as $field) {
            if ($usesQueuePosition && $field === 'priority') {
                continue;
            }
            $value = is_array($task) ? ($task[$field] ?? null) : ($task->{$field} ?? null);
            if ($value instanceof DateTimeInterface) {
                $value = method_exists($value, 'toISOString')
                    ? $value->toISOString()
                    : $value->format(DateTimeInterface::ATOM);
            }
            if ($field === 'is_fast_tier') {
                $value = (bool) $value;
            } elseif (in_array($field, [
                'priority',
                'queue_position',
                'retry_count',
                'max_retries',
                'timeout_seconds',
                'elapsed_seconds',
                'total_attempts',
                'estimated_timeout_in_seconds',
            ], true) && $value !== null) {
                $value = (int) $value;
            } elseif ($field === 'will_retry') {
                $value = (bool) $value;
            } elseif ($field === 'progress' && $value !== null) {
                $value = (float) $value;
            }
            $record[$field] = $value;
        }
        return $record;
    }

    public static function categoryKeys(): array
    {
        return array_values(array_map(
            static fn (array $definition): string => (string) ($definition['key'] ?? ''),
            self::categories()
        ));
    }

    public static function globalTaskTypeForCategory(string $category): ?string
    {
        foreach (self::categories() as $definition) {
            if (($definition['key'] ?? null) === $category) {
                $value = $definition['laravel_task_type'] ?? null;
                return is_string($value) && $value !== '' ? $value : null;
            }
        }
        return null;
    }

    public static function claimantsForCapability(?string $capability): array
    {
        $all = [];
        if ($capability === null) {
            foreach (self::document()['capability_claimants'] ?? [] as $claimants) {
                if (is_array($claimants)) {
                    $all = array_merge($all, $claimants);
                }
            }
        } else {
            $all = self::document()['capability_claimants'][$capability] ?? [];
        }
        foreach (self::taskTypes() as $definition) {
            if (($capability === null || ($definition['capability'] ?? null) === $capability)
                && is_array($definition['claimants'] ?? null)) {
                $all = array_merge($all, $definition['claimants']);
            }
        }
        return array_values(array_unique($all));
    }

    /**
     * Merge Laravel metrics into every canonical category without changing the
     * catalog, claimant, or handler metadata owned by the shared contract.
     */
    public static function normalizeCategories(array $metricsByKey, array $workers = []): array
    {
        $categories = [];
        foreach (self::categories() as $definition) {
            $key = (string) ($definition['key'] ?? '');
            $metrics = is_array($metricsByKey[$key] ?? null) ? $metricsByKey[$key] : [];
            $taskDefinition = self::taskTypeDefinition($key);
            $tokens = array_values(array_filter([
                $key,
                $definition['capability'] ?? null,
                $taskDefinition['execution_type'] ?? null,
            ]));
            $primaryHandler = (string) ($definition['primary_handler'] ?? 'pycore');
            $claimants = is_array($taskDefinition['claimants'] ?? null)
                ? array_values($taskDefinition['claimants'])
                : (($definition['capability'] ?? null) === null
                    ? [$primaryHandler]
                    : self::claimantsForCapability((string) $definition['capability']));
            $activeHandlers = [];
            foreach ($workers as $worker) {
                $processors = is_array($worker['processor_types'] ?? null) ? $worker['processor_types'] : [];
                if (($worker['online'] ?? false) && array_intersect($tokens, $processors)) {
                    $activeHandlers[] = (string) ($worker['kind'] ?? '');
                }
            }
            $row = array_merge([
                'key' => $key,
                'label' => (string) ($definition['label'] ?? $key),
                'capability' => $definition['capability'] ?? null,
                'primary_handler' => $primaryHandler,
                'claimants' => $claimants,
                'active_handlers' => array_values(array_unique(array_filter($activeHandlers))),
            ], self::queueMetricDefaults(), $metrics);
            foreach (array_keys(self::document()['metric_semantics'] ?? []) as $field) {
                $row[$field] = (int) ($row[$field] ?? 0);
            }
            $categories[] = $row;
        }

        return $categories;
    }
}
