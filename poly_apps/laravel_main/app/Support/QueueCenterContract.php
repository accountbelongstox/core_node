<?php

namespace App\Support;

use DateTimeInterface;
use RuntimeException;

/**
 * Laravel adapter for the canonical Queue Center and distributed-task contract.
 *
 * Source: config/queue_center_contract.json
 * Aligned adapters:
 * - pycore/callmodule/services/queue_center_contract.py
 * - poly_apps/pycore_laravel_wordnew_ui/core/api-libs/pycore/QueueCenterContract.ts
 * - apps/mcp-chrome/app/chrome-extension/utils/queue-center-contract.ts
 *
 * A task status, lane, capability, priority, task-type route, or wire field must
 * be changed in the JSON source first. The other adapters read the same file;
 * no controller, worker, or UI may maintain a second vocabulary.
 */
final class QueueCenterContract
{
    private static ?array $document = null;

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

        self::$document = $document;
        return self::$document;
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

    public static function taskTypeDefinition(string $taskType): ?array
    {
        foreach (self::taskTypes() as $definition) {
            if (($definition['key'] ?? null) === $taskType) {
                return $definition;
            }
        }
        return null;
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
        foreach (self::taskWireShape($shape) as $field) {
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
        if ($capability === null) {
            $all = [];
            foreach (self::document()['capability_claimants'] ?? [] as $claimants) {
                if (is_array($claimants)) {
                    $all = array_merge($all, $claimants);
                }
            }
            foreach (self::taskTypes() as $definition) {
                if (($definition['capability'] ?? null) === null
                    && is_array($definition['claimants'] ?? null)) {
                    $all = array_merge($all, $definition['claimants']);
                }
            }
            return array_values(array_unique($all));
        }
        return array_values(self::document()['capability_claimants'][$capability] ?? []);
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
            $tokens = array_values(array_filter([$key, $definition['capability'] ?? null]));
            $primaryHandler = (string) ($definition['primary_handler'] ?? 'pycore');
            $claimants = ($definition['capability'] ?? null) === null
                ? [$primaryHandler]
                : self::claimantsForCapability((string) $definition['capability']);
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
