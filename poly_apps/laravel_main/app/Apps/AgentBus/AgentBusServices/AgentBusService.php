<?php

namespace App\Apps\AgentBus\AgentBusServices;

use App\Apps\AgentBus\AgentBusExceptions\AgentBusException;
use App\Apps\AgentBus\AgentBusTablesMaps\AgentBusTablesMaps;
use App\Services\ClientKey\ClientKeyAuthService;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** One implementation behind both the REST routes and the MCP tools. */
final class AgentBusService
{
    private const HTTP_BAD_REQUEST = 400;
    private const HTTP_FORBIDDEN = 403;
    private const HTTP_NOT_FOUND = 404;
    private const HTTP_CONFLICT = 409;
    private const HTTP_UNPROCESSABLE = 422;
    private const LEASE_MIN_SECONDS = 60;
    private const TARGET_SEPARATOR = ':';
    private const BROADCAST = 'broadcast';
    private const ANY = 'any';
    private const STATUS_OPEN = 'open';
    private const STATUS_CLAIMED = 'claimed';
    private const STATUS_CANCELLED = 'cancelled';
    private const KIND_REQUEST = 'request';
    private const KIND_REPLY = 'reply';
    private const KIND_STATUS = 'status';
    private const KIND_NOTE = 'note';
    private const WAKE_MESSAGE = 'message';
    private const PATTERN_DELIMITER = '~';

    public function call(string $operation, array $args, Request $request): array
    {
        $definition = AgentBusContract::operation($operation);

        if ($definition === null) {
            throw new AgentBusException('unknown_operation', self::HTTP_NOT_FOUND, ['name' => $operation]);
        }
        $args = $this->normalizeArgs($definition, $args);

        return match ($operation) {
            'register' => $this->register($args, $request),
            'heartbeat' => $this->heartbeat($args, $request),
            'agents' => $this->agents($args, $request),
            'send' => $this->send($args, $request),
            'inbox' => $this->inbox($args, $request),
            'ack' => $this->ack($args, $request),
            'task_request' => $this->taskRequest($args, $request),
            'tasks' => $this->tasks($args, $request),
            'task_get' => ['task' => $this->presentTask($this->findTask((int) $args['id']))],
            'task_claim' => $this->taskClaim($args, $request),
            'task_update' => $this->taskUpdate($args, $request),
            'task_complete' => $this->taskComplete($args, $request),
            'note_put' => $this->notePut($args, $request),
            'note_get' => $this->noteGet($args),
            'notes' => $this->notes($args),
            'realtime' => ['realtime' => AgentBusRealtime::connection($this->touch($this->identity($args, $request)))],
        };
    }

    public static function decodeList(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return is_array($decoded) ? array_values($decoded) : [];
    }

    // ---- agents -------------------------------------------------------

    private function register(array $args, Request $request): array
    {
        $agentId = $this->identity($args, $request);
        $fields = [];

        foreach (['roles', 'channels', 'capabilities'] as $listField) {
            if (array_key_exists($listField, $args)) {
                $fields[$listField] = json_encode($this->labels($args[$listField], $listField), JSON_THROW_ON_ERROR);
            }
        }
        if (array_key_exists('client', $args)) {
            $fields['client'] = $this->segment($args['client'], 'client');
        }
        $fields += $this->statusFields($args);
        $agent = $this->touch($agentId, $fields);

        return [
            'agent' => $this->presentAgent($agent),
            'unread' => $this->unread($agent),
            'realtime_topics' => AgentBusRealtime::topicsForAgent($agent),
            'presence_ttl_seconds' => AgentBusContract::limit('presence_ttl_seconds'),
        ];
    }

    private function heartbeat(array $args, Request $request): array
    {
        $agent = $this->touch($this->identity($args, $request), $this->statusFields($args));

        return ['agent' => $this->presentAgent($agent), 'unread' => $this->unread($agent)];
    }

    private function agents(array $args, Request $request): array
    {
        $query = $this->table('AGENTS')->orderByDesc('last_seen_at')->limit(AgentBusContract::limit('page_size_max'));
        $caller = $this->identity($args, $request, false);

        if ($caller !== null) {
            $this->touch($caller);
        }
        if (!empty($args['online_only'])) {
            $query->where('last_seen_at', '>=', $this->presenceCutoff());
        }
        if (isset($args['role'])) {
            $query->whereRaw('roles::jsonb @> ?::jsonb', [json_encode([$this->segment($args['role'], 'role')])]);
        }

        return ['agents' => $query->get()->map(fn (object $agent): array => $this->presentAgent($agent))->all()];
    }

    private function statusFields(array $args): array
    {
        $fields = [];

        if (array_key_exists('status', $args)) {
            $fields['status'] = $args['status'];
        }
        if (array_key_exists('summary', $args)) {
            $fields['summary'] = $this->text($args['summary'], 'summary', AgentBusContract::limit('summary_max'));
        }

        return $fields;
    }

    /** Upsert presence; writes only when fields change or the last touch is older than the touch interval. */
    private function touch(string $agentId, array $fields = []): object
    {
        $now = now();
        $agent = $this->table('AGENTS')->where('agent_id', $agentId)->first();
        $parts = explode(AgentBusContract::identity('separator'), $agentId, 2);
        $stale = false;

        if ($agent === null) {
            $this->table('AGENTS')->insertOrIgnore(array_merge([
                'agent_id' => $agentId,
                'machine' => $parts[0],
                'name' => $parts[1],
                'roles' => '[]',
                'channels' => '[]',
                'capabilities' => '[]',
                'status' => 'idle',
                'inbox_cursor' => 0,
                'created_at' => $now,
            ], $fields, ['last_seen_at' => $now, 'updated_at' => $now]));

            return $this->table('AGENTS')->where('agent_id', $agentId)->first();
        }
        $stale = $agent->last_seen_at === null
            || Carbon::parse($agent->last_seen_at)->lt($now->copy()->subSeconds(AgentBusContract::limit('touch_interval_seconds')));
        if ($fields === [] && !$stale) {
            return $agent;
        }
        $this->table('AGENTS')->where('agent_id', $agentId)
            ->update(array_merge($fields, ['last_seen_at' => $now, 'updated_at' => $now]));

        return $this->table('AGENTS')->where('agent_id', $agentId)->first();
    }

    private function presenceCutoff(): Carbon
    {
        return now()->subSeconds(AgentBusContract::limit('presence_ttl_seconds'));
    }

    // ---- messages -----------------------------------------------------

    private function send(array $args, Request $request): array
    {
        $from = $this->identity($args, $request);
        [$targetKind, $target] = $this->target($args['to'], AgentBusContract::get('target_kinds'));
        $message = $this->postMessage(
            $from,
            $targetKind,
            $target,
            $args['kind'] ?? self::KIND_NOTE,
            $this->text($args['subject'], 'subject', AgentBusContract::limit('subject_max')),
            $this->text($args['body'] ?? '', 'body', AgentBusContract::limit('body_max')),
            $this->refs($args['refs'] ?? []),
            $args['reply_to'] ?? null,
            $args['task_id'] ?? null
        );
        $this->touch($from);

        return ['message' => $message];
    }

    private function postMessage(
        string $from,
        string $targetKind,
        string $target,
        string $kind,
        string $subject,
        string $body,
        array $refs,
        ?int $replyTo = null,
        ?int $taskId = null
    ): array {
        $id = (int) $this->table('MESSAGES')->insertGetId([
            'from_agent' => $from,
            'to_kind' => $targetKind,
            'to_target' => $target,
            'kind' => $kind,
            'subject' => $subject,
            'body' => $body,
            'refs' => json_encode($refs, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'reply_to' => $replyTo,
            'task_id' => $taskId,
            'created_at' => now(),
        ]);

        AgentBusRealtime::wake($targetKind, $target, self::WAKE_MESSAGE, $id);

        return $this->presentMessage($this->table('MESSAGES')->where('id', $id)->first());
    }

    private function inbox(array $args, Request $request): array
    {
        $agent = $this->touch($this->identity($args, $request));
        $after = array_key_exists('after', $args) ? max(0, (int) $args['after']) : (int) $agent->inbox_cursor;
        $limit = $this->pageSize($args);
        $rows = $this->visibleMessages($agent)->where('id', '>', $after)->orderBy('id')->limit($limit + 1)->get();
        $hasMore = $rows->count() > $limit;
        $rows = $rows->take($limit);
        $last = $rows->isEmpty() ? $after : (int) $rows->last()->id;

        if (empty($args['peek']) && $last > (int) $agent->inbox_cursor) {
            $this->advanceCursor($agent->agent_id, $last);
            $agent = $this->table('AGENTS')->where('agent_id', $agent->agent_id)->first();
        }

        return [
            'messages' => $rows->map(fn (object $row): array => $this->presentMessage($row))->values()->all(),
            'next_after' => $last,
            'has_more' => $hasMore,
            'cursor' => (int) $agent->inbox_cursor,
            'unread' => $this->unread($agent),
        ];
    }

    private function ack(array $args, Request $request): array
    {
        $agent = $this->touch($this->identity($args, $request));
        $upTo = (int) $args['up_to'];
        $latest = (int) ($this->table('MESSAGES')->max('id') ?? 0);

        if ($upTo < 0 || $upTo > $latest) {
            throw new AgentBusException('ack_out_of_range', self::HTTP_UNPROCESSABLE, ['latest' => $latest]);
        }
        $this->advanceCursor($agent->agent_id, $upTo);
        $agent = $this->table('AGENTS')->where('agent_id', $agent->agent_id)->first();

        return ['cursor' => (int) $agent->inbox_cursor, 'unread' => $this->unread($agent)];
    }

    private function advanceCursor(string $agentId, int $messageId): void
    {
        $this->table('AGENTS')->where('agent_id', $agentId)
            ->update(['inbox_cursor' => DB::raw('GREATEST(inbox_cursor, '.$messageId.')')]);
    }

    private function visibleMessages(object $agent): Builder
    {
        $roles = self::decodeList($agent->roles);
        $channels = self::decodeList($agent->channels);
        $agentId = $agent->agent_id;

        return $this->table('MESSAGES')
            ->where('from_agent', '!=', $agentId)
            ->where(function (Builder $query) use ($agentId, $roles, $channels): void {
                $query->where(fn (Builder $inner) => $inner->where('to_kind', 'agent')->where('to_target', $agentId))
                    ->orWhere('to_kind', self::BROADCAST);
                if ($roles !== []) {
                    $query->orWhere(fn (Builder $inner) => $inner->where('to_kind', 'role')->whereIn('to_target', $roles));
                }
                if ($channels !== []) {
                    $query->orWhere(fn (Builder $inner) => $inner->where('to_kind', 'channel')->whereIn('to_target', $channels));
                }
            });
    }

    private function unread(object $agent): int
    {
        $ids = $this->visibleMessages($agent)->where('id', '>', (int) $agent->inbox_cursor)
            ->select('id')->limit(AgentBusContract::limit('unread_count_cap'));

        return $this->db()->query()->fromSub($ids, 'unread_ids')->count();
    }

    // ---- tasks --------------------------------------------------------

    private function taskRequest(array $args, Request $request): array
    {
        $requester = $this->identity($args, $request);
        [$targetKind, $target] = $this->target($args['to'] ?? self::ANY, AgentBusContract::get('task_target_kinds'));
        $title = $this->text($args['title'], 'title', AgentBusContract::limit('subject_max'));
        $body = $this->text($args['body'] ?? '', 'body', AgentBusContract::limit('body_max'));
        $refs = $this->refs($args['refs'] ?? []);
        $now = now();
        $id = (int) $this->table('TASKS')->insertGetId([
            'title' => $title,
            'body' => $body,
            'requester' => $requester,
            'target_kind' => $targetKind,
            'target' => $target,
            'status' => self::STATUS_OPEN,
            'priority' => (int) ($args['priority'] ?? 0),
            'refs' => json_encode($refs, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'result_refs' => '[]',
            'revision' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->postMessage(
            $requester,
            $targetKind === self::ANY ? self::BROADCAST : $targetKind,
            $targetKind === self::ANY ? self::BROADCAST : $target,
            self::KIND_REQUEST,
            $title,
            $body,
            array_merge(['task:'.$id], $refs),
            null,
            $id
        );
        $this->touch($requester);

        return ['task' => $this->presentTask($this->findTask($id))];
    }

    private function tasks(array $args, Request $request): array
    {
        $limit = $this->pageSize($args);
        $query = $this->table('TASKS')->orderByDesc('id')->limit($limit + 1);
        $statuses = [];
        $agent = null;
        $rows = null;

        if (isset($args['status']) && $args['status'] !== '') {
            $statuses = array_values(array_filter(array_map('trim', explode(',', (string) $args['status']))));
            foreach ($statuses as $status) {
                $this->assertEnum($status, AgentBusContract::get('task_statuses'), 'status');
            }
            $query->whereIn('status', $statuses);
        }
        if (isset($args['before'])) {
            $query->where('id', '<', (int) $args['before']);
        }
        if (!empty($args['mine'])) {
            $agent = $this->touch($this->identity($args, $request));
            $roles = self::decodeList($agent->roles);
            $query->where(function (Builder $inner) use ($agent, $roles): void {
                $inner->where('assignee', $agent->agent_id)
                    ->orWhere(fn (Builder $q) => $q->where('target_kind', 'agent')->where('target', $agent->agent_id));
                if ($roles !== []) {
                    $inner->orWhere(fn (Builder $q) => $q->where('target_kind', 'role')->whereIn('target', $roles));
                }
            });
        }
        $rows = $query->get();

        return [
            'tasks' => $rows->take($limit)->map(fn (object $task): array => $this->presentTask($task))->values()->all(),
            'has_more' => $rows->count() > $limit,
            'next_before' => $rows->count() > $limit ? (int) $rows->take($limit)->last()->id : null,
        ];
    }

    private function taskClaim(array $args, Request $request): array
    {
        $me = $this->identity($args, $request);
        $id = (int) $args['id'];
        $now = now();
        $before = $this->findTask($id);
        $affected = $this->table('TASKS')->where('id', $id)
            ->where(fn (Builder $q) => $this->claimable($q, $me, $now))
            ->where(fn (Builder $q) => $q->where('target_kind', '!=', 'agent')->orWhere('target', $me))
            ->update([
                'status' => self::STATUS_CLAIMED,
                'assignee' => $me,
                'lease_until' => $now->copy()->addSeconds($this->leaseSeconds($args)),
                'revision' => DB::raw('revision + 1'),
                'updated_at' => $now,
            ]);

        if ($affected === 0) {
            throw new AgentBusException('task_not_claimable', self::HTTP_CONFLICT, ['id' => $id], $this->presentTask($before));
        }
        if ($before->assignee !== $me) {
            $this->notifyTask($me, $before, 'claimed', $before->requester);
        }
        $this->touch($me);

        return ['task' => $this->presentTask($this->findTask($id))];
    }

    private function claimable(Builder $query, string $me, Carbon $now): void
    {
        $query->where('status', self::STATUS_OPEN)
            ->orWhere(fn (Builder $q) => $q->where('status', self::STATUS_CLAIMED)->where('lease_until', '<', $now))
            ->orWhere(fn (Builder $q) => $q->where('status', self::STATUS_CLAIMED)->where('assignee', $me));
    }

    private function taskUpdate(array $args, Request $request): array
    {
        $me = $this->identity($args, $request);
        $id = (int) $args['id'];
        $task = $this->findTask($id);
        $now = now();
        $affected = 0;

        if ($args['action'] === 'cancel') {
            $affected = $this->table('TASKS')->where('id', $id)->where('requester', $me)
                ->whereNotIn('status', AgentBusContract::get('task_terminal_statuses'))
                ->update([
                    'status' => self::STATUS_CANCELLED,
                    'lease_until' => null,
                    'completed_at' => $now,
                    'revision' => DB::raw('revision + 1'),
                    'updated_at' => $now,
                ]);
            if ($affected > 0 && $task->assignee !== null) {
                $this->notifyTask($me, $task, 'cancelled', $task->assignee);
            }
        } else {
            $changes = $args['action'] === 'release'
                ? ['status' => self::STATUS_OPEN, 'assignee' => null, 'lease_until' => null]
                : ['lease_until' => $now->copy()->addSeconds($this->leaseSeconds($args))];
            if (array_key_exists('progress', $args)) {
                $changes['progress'] = $this->text($args['progress'], 'progress', AgentBusContract::limit('body_max'));
            }
            $affected = $this->table('TASKS')->where('id', $id)->where('assignee', $me)->where('status', self::STATUS_CLAIMED)
                ->update(array_merge($changes, ['revision' => DB::raw('revision + 1'), 'updated_at' => $now]));
            if ($affected > 0 && $args['action'] === 'release') {
                $this->notifyTask($me, $task, 'released', $task->requester);
            }
        }
        if ($affected === 0) {
            throw new AgentBusException('task_not_held', self::HTTP_CONFLICT, ['id' => $id], $this->presentTask($task));
        }
        $this->touch($me);

        return ['task' => $this->presentTask($this->findTask($id))];
    }

    private function taskComplete(array $args, Request $request): array
    {
        $me = $this->identity($args, $request);
        $id = (int) $args['id'];
        $now = now();
        $task = $this->findTask($id);
        $result = $this->text($args['result'] ?? '', 'result', AgentBusContract::limit('body_max'));
        $refs = $this->refs($args['refs'] ?? []);
        $affected = $this->table('TASKS')->where('id', $id)
            ->where(fn (Builder $q) => $this->claimable($q, $me, $now))
            ->where(fn (Builder $q) => $q->where('target_kind', '!=', 'agent')->orWhere('target', $me))
            ->update([
                'status' => $args['status'],
                'assignee' => $me,
                'lease_until' => null,
                'result' => $result,
                'result_refs' => json_encode($refs, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'completed_at' => $now,
                'revision' => DB::raw('revision + 1'),
                'updated_at' => $now,
            ]);

        if ($affected === 0) {
            throw new AgentBusException('task_not_held', self::HTTP_CONFLICT, ['id' => $id], $this->presentTask($task));
        }
        $this->postMessage(
            $me,
            'agent',
            $task->requester,
            self::KIND_REPLY,
            $this->taskSubject($task, (string) $args['status']),
            $result,
            array_merge(['task:'.$id], $refs),
            null,
            $id
        );
        $this->touch($me);

        return ['task' => $this->presentTask($this->findTask($id))];
    }

    private function notifyTask(string $from, object $task, string $event, string $to): void
    {
        if ($to === $from) {
            return;
        }
        $this->postMessage($from, 'agent', $to, self::KIND_STATUS, $this->taskSubject($task, $event), '', ['task:'.$task->id], null, (int) $task->id);
    }

    private function taskSubject(object $task, string $event): string
    {
        return mb_substr(__('agent_bus.task_event_subject', [
            'id' => $task->id,
            'event' => $event,
            'title' => $task->title,
        ]), 0, AgentBusContract::limit('subject_max'));
    }

    private function findTask(int $id): object
    {
        $task = $this->table('TASKS')->where('id', $id)->first();

        if ($task === null) {
            throw new AgentBusException('task_not_found', self::HTTP_NOT_FOUND, ['id' => $id]);
        }

        return $task;
    }

    private function leaseSeconds(array $args): int
    {
        return max(self::LEASE_MIN_SECONDS, min(
            (int) ($args['lease_seconds'] ?? AgentBusContract::limit('lease_default_seconds')),
            AgentBusContract::limit('lease_max_seconds')
        ));
    }

    // ---- notes --------------------------------------------------------

    private function notePut(array $args, Request $request): array
    {
        $author = $this->identity($args, $request);
        $key = $this->noteKey($args['key']);
        $body = $this->text($args['body'], 'body', AgentBusContract::limit('note_body_max'));
        $fields = ['body' => $body, 'author' => $author, 'updated_at' => now()];
        $note = null;
        $target = null;

        if (array_key_exists('title', $args)) {
            $fields['title'] = $this->text($args['title'], 'title', AgentBusContract::limit('subject_max'));
        }
        if (array_key_exists('tags', $args)) {
            $fields['tags'] = json_encode($this->labels($args['tags'], 'tags'), JSON_THROW_ON_ERROR);
        }
        if (array_key_exists('refs', $args)) {
            $fields['refs'] = json_encode($this->refs($args['refs']), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
        if (isset($args['notify'])) {
            $target = $this->target($args['notify'], AgentBusContract::get('target_kinds'));
        }

        $note = $this->db()->transaction(function () use ($key, $fields, $args): object {
            $existing = $this->table('NOTES')->where('note_key', $key)->lockForUpdate()->first();
            $current = $existing === null ? 0 : (int) $existing->revision;

            if (array_key_exists('if_revision', $args) && (int) $args['if_revision'] !== $current) {
                throw new AgentBusException('note_revision_conflict', self::HTTP_CONFLICT, ['key' => $key], ['revision' => $current]);
            }
            if ($existing !== null) {
                $this->table('NOTES')->where('id', $existing->id)->update(array_merge($fields, ['revision' => DB::raw('revision + 1')]));
            } elseif ($this->table('NOTES')->insertOrIgnore(array_merge(
                ['note_key' => $key, 'tags' => '[]', 'refs' => '[]', 'revision' => 1, 'created_at' => $fields['updated_at']],
                $fields
            )) === 0) {
                throw new AgentBusException('note_revision_conflict', self::HTTP_CONFLICT, ['key' => $key], ['revision' => $current]);
            }

            return $this->table('NOTES')->where('note_key', $key)->first();
        });

        if ($target !== null) {
            $this->postMessage(
                $author,
                $target[0],
                $target[1],
                self::KIND_NOTE,
                mb_substr((string) ($note->title ?: $note->note_key), 0, AgentBusContract::limit('subject_max')),
                $this->excerpt($note->body),
                ['note:'.$note->note_key]
            );
        }
        $this->touch($author);

        return ['note' => $this->presentNote($note, true)];
    }

    private function noteGet(array $args): array
    {
        $key = $this->noteKey($args['key']);
        $note = $this->table('NOTES')->where('note_key', $key)->first();

        if ($note === null) {
            throw new AgentBusException('note_not_found', self::HTTP_NOT_FOUND, ['key' => $key]);
        }

        return ['note' => $this->presentNote($note, true)];
    }

    private function notes(array $args): array
    {
        $limit = $this->pageSize($args);
        $query = $this->table('NOTES')->orderByDesc('id')->limit($limit + 1);
        $rows = null;
        $needle = '';

        if (isset($args['q']) && trim((string) $args['q']) !== '') {
            $needle = '%'.$this->escapeLike(trim((string) $args['q'])).'%';
            $query->where(fn (Builder $q) => $q->where('note_key', 'ilike', $needle)
                ->orWhere('title', 'ilike', $needle)
                ->orWhere('body', 'ilike', $needle));
        }
        if (isset($args['prefix']) && $args['prefix'] !== '') {
            $query->where('note_key', 'like', $this->escapeLike((string) $args['prefix']).'%');
        }
        if (isset($args['tag']) && $args['tag'] !== '') {
            $query->whereRaw('tags::jsonb @> ?::jsonb', [json_encode([$this->segment($args['tag'], 'tag')])]);
        }
        if (isset($args['before'])) {
            $query->where('id', '<', (int) $args['before']);
        }
        $rows = $query->get();

        return [
            'notes' => $rows->take($limit)->map(fn (object $note): array => $this->presentNote($note, false))->values()->all(),
            'has_more' => $rows->count() > $limit,
            'next_before' => $rows->count() > $limit ? (int) $rows->take($limit)->last()->id : null,
        ];
    }

    private function noteKey(mixed $value): string
    {
        $key = trim((string) $value);

        if (preg_match($this->pattern(AgentBusContract::identity('note_key_pattern')), $key) !== 1) {
            throw new AgentBusException('argument_invalid', self::HTTP_UNPROCESSABLE, ['name' => 'key']);
        }

        return $key;
    }

    // ---- identity and arguments ---------------------------------------

    /** Agent id = machine/name; machine comes from the K3 signature, else user-<id> for a dashboard caller. */
    private function identity(array $args, Request $request, bool $required = true): ?string
    {
        $raw = trim((string) ($args['agent'] ?? $request->header(AgentBusContract::identity('agent_header'), '')));
        $separator = AgentBusContract::identity('separator');
        $signedMachine = (string) $request->attributes->get(ClientKeyAuthService::ATTRIBUTE_MACHINE_ID, '');
        $machine = '';
        $name = $raw;

        if ($raw === '') {
            if ($required) {
                throw new AgentBusException('agent_required', self::HTTP_BAD_REQUEST, [
                    'header' => AgentBusContract::identity('agent_header'),
                ]);
            }

            return null;
        }
        if (str_contains($raw, $separator)) {
            [$machine, $name] = explode($separator, $raw, 2);
            if ($signedMachine !== '' && $machine !== $signedMachine) {
                throw new AgentBusException('agent_machine_mismatch', self::HTTP_FORBIDDEN, ['machine' => $signedMachine]);
            }
        } elseif ($signedMachine !== '') {
            $machine = $signedMachine;
        } elseif ($request->user() !== null) {
            $machine = AgentBusContract::identity('user_machine_prefix').$request->user()->getKey();
        }
        if ($machine === '') {
            throw new AgentBusException('agent_machine_required', self::HTTP_BAD_REQUEST);
        }

        return $this->segment($machine, 'agent').$separator.$this->segment($name, 'agent');
    }

    /** @return array{0: string, 1: string} */
    private function target(mixed $value, array $allowedKinds): array
    {
        $raw = trim((string) $value);
        $kind = '';
        $target = '';

        if ($raw === self::BROADCAST || $raw === self::ANY) {
            $kind = $raw;
            $target = $raw;
        } elseif (str_contains($raw, self::TARGET_SEPARATOR)) {
            [$kind, $target] = explode(self::TARGET_SEPARATOR, $raw, 2);
        } else {
            $kind = 'agent';
            $target = $raw;
        }
        if (!in_array($kind, $allowedKinds, true)) {
            throw new AgentBusException('target_invalid', self::HTTP_UNPROCESSABLE, [
                'target' => $raw,
                'kinds' => implode(', ', $allowedKinds),
            ]);
        }
        if ($kind === 'agent') {
            return [$kind, $this->resolveAgent($target)];
        }
        if ($kind === 'role' || $kind === 'channel') {
            return [$kind, $this->segment($target, 'to')];
        }

        return [$kind, $kind];
    }

    /** Accepts machine/name, or a bare name when exactly one registered agent has it. */
    private function resolveAgent(string $value): string
    {
        $separator = AgentBusContract::identity('separator');
        $matches = [];

        if (str_contains($value, $separator)) {
            if (!$this->table('AGENTS')->where('agent_id', $value)->exists()) {
                throw new AgentBusException('agent_unknown', self::HTTP_NOT_FOUND, ['agent' => $value]);
            }

            return $value;
        }
        $matches = $this->table('AGENTS')->where('name', $value)->limit(2)->pluck('agent_id')->all();
        if (count($matches) !== 1) {
            throw new AgentBusException(
                $matches === [] ? 'agent_unknown' : 'agent_ambiguous',
                $matches === [] ? self::HTTP_NOT_FOUND : self::HTTP_CONFLICT,
                ['agent' => $value]
            );
        }

        return $matches[0];
    }

    private function normalizeArgs(array $definition, array $args): array
    {
        $normalized = [];

        foreach ($definition['params'] ?? [] as $name => $param) {
            if (!array_key_exists($name, $args) || $args[$name] === null || $args[$name] === '') {
                if (!empty($param['required'])) {
                    throw new AgentBusException('argument_required', self::HTTP_UNPROCESSABLE, ['name' => $name]);
                }
                continue;
            }
            $normalized[$name] = $this->castArg($name, $param, $args[$name]);
        }

        return $normalized;
    }

    private function castArg(string $name, array $param, mixed $value): mixed
    {
        $enum = $param['enum'] ?? (isset($param['enum_ref']) ? AgentBusContract::get($param['enum_ref']) : null);
        $cast = match ($param['type']) {
            'integer' => filter_var($value, FILTER_VALIDATE_INT),
            'boolean' => is_bool($value) ? $value : filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE),
            'array' => is_array($value) ? array_values($value) : (is_string($value) ? array_values(array_filter(array_map('trim', explode(',', $value)), 'strlen')) : null),
            default => is_scalar($value) ? (string) $value : null,
        };
        if ($cast === null || ($cast === false && $param['type'] === 'integer')) {
            throw new AgentBusException('argument_invalid', self::HTTP_UNPROCESSABLE, ['name' => $name]);
        }
        if ($enum !== null) {
            $this->assertEnum((string) $cast, $enum, $name);
        }

        return $cast;
    }

    private function assertEnum(string $value, array $allowed, string $name): void
    {
        if (!in_array($value, $allowed, true)) {
            throw new AgentBusException('argument_enum', self::HTTP_UNPROCESSABLE, [
                'name' => $name,
                'allowed' => implode(', ', $allowed),
            ]);
        }
    }

    private function segment(mixed $value, string $name): string
    {
        $text = trim((string) $value);

        if (preg_match($this->pattern(AgentBusContract::identity('segment_pattern')), $text) !== 1) {
            throw new AgentBusException('argument_invalid', self::HTTP_UNPROCESSABLE, ['name' => $name]);
        }

        return $text;
    }

    private function labels(array $values, string $name): array
    {
        $labels = array_values(array_unique(array_map(fn (mixed $value): string => $this->segment($value, $name), $values)));

        if (count($labels) > AgentBusContract::limit('labels_max')) {
            throw new AgentBusException('argument_too_long', self::HTTP_UNPROCESSABLE, ['name' => $name]);
        }

        return $labels;
    }

    private function refs(array $values): array
    {
        $refs = [];

        foreach ($values as $value) {
            $refs[] = $this->text($value, 'refs', AgentBusContract::limit('ref_max'));
        }
        if (count($refs) > AgentBusContract::limit('refs_max')) {
            throw new AgentBusException('argument_too_long', self::HTTP_UNPROCESSABLE, ['name' => 'refs']);
        }

        return array_values(array_filter($refs, 'strlen'));
    }

    private function text(mixed $value, string $name, int $max): string
    {
        $text = is_scalar($value) ? trim((string) $value) : null;

        if ($text === null) {
            throw new AgentBusException('argument_invalid', self::HTTP_UNPROCESSABLE, ['name' => $name]);
        }
        if (mb_strlen($text) > $max) {
            throw new AgentBusException('argument_too_long', self::HTTP_UNPROCESSABLE, ['name' => $name]);
        }

        return $text;
    }

    private function pageSize(array $args): int
    {
        return max(1, min(
            (int) ($args['limit'] ?? AgentBusContract::limit('page_size_default')),
            AgentBusContract::limit('page_size_max')
        ));
    }

    private function pattern(string $expression): string
    {
        return self::PATTERN_DELIMITER.$expression.self::PATTERN_DELIMITER;
    }

    private function escapeLike(string $value): string
    {
        return addcslashes($value, '%_\\');
    }

    private function excerpt(?string $text): string
    {
        $text = (string) $text;
        $max = AgentBusContract::limit('excerpt_chars');

        return mb_strlen($text) > $max ? mb_substr($text, 0, $max).'…' : $text;
    }

    // ---- presenters ---------------------------------------------------

    private function presentAgent(object $agent): array
    {
        return [
            'agent_id' => $agent->agent_id,
            'machine' => $agent->machine,
            'name' => $agent->name,
            'client' => $agent->client,
            'roles' => self::decodeList($agent->roles),
            'channels' => self::decodeList($agent->channels),
            'capabilities' => self::decodeList($agent->capabilities),
            'status' => $agent->status,
            'summary' => $agent->summary,
            'online' => $agent->last_seen_at !== null && Carbon::parse($agent->last_seen_at)->gte($this->presenceCutoff()),
            'last_seen_at' => $this->iso($agent->last_seen_at),
        ];
    }

    private function presentMessage(object $message): array
    {
        return [
            'id' => (int) $message->id,
            'from' => $message->from_agent,
            'to' => $message->to_kind === self::BROADCAST ? self::BROADCAST : $message->to_kind.self::TARGET_SEPARATOR.$message->to_target,
            'kind' => $message->kind,
            'subject' => $message->subject,
            'body' => $message->body,
            'refs' => self::decodeList($message->refs),
            'reply_to' => $message->reply_to === null ? null : (int) $message->reply_to,
            'task_id' => $message->task_id === null ? null : (int) $message->task_id,
            'created_at' => $this->iso($message->created_at),
        ];
    }

    private function presentTask(object $task): array
    {
        $leaseExpired = $task->status === self::STATUS_CLAIMED
            && $task->lease_until !== null
            && Carbon::parse($task->lease_until)->lt(now());

        return [
            'id' => (int) $task->id,
            'title' => $task->title,
            'body' => $task->body,
            'requester' => $task->requester,
            'to' => $task->target_kind === self::ANY ? self::ANY : $task->target_kind.self::TARGET_SEPARATOR.$task->target,
            'status' => $task->status,
            'assignee' => $task->assignee,
            'lease_until' => $this->iso($task->lease_until),
            'lease_expired' => $leaseExpired,
            'priority' => (int) $task->priority,
            'progress' => $task->progress,
            'result' => $task->result,
            'refs' => self::decodeList($task->refs),
            'result_refs' => self::decodeList($task->result_refs),
            'revision' => (int) $task->revision,
            'created_at' => $this->iso($task->created_at),
            'updated_at' => $this->iso($task->updated_at),
            'completed_at' => $this->iso($task->completed_at),
        ];
    }

    private function presentNote(object $note, bool $full): array
    {
        return [
            'id' => (int) $note->id,
            'key' => $note->note_key,
            'title' => $note->title,
            $full ? 'body' : 'excerpt' => $full ? $note->body : $this->excerpt($note->body),
            'tags' => self::decodeList($note->tags),
            'refs' => self::decodeList($note->refs),
            'author' => $note->author,
            'revision' => (int) $note->revision,
            'updated_at' => $this->iso($note->updated_at),
        ];
    }

    private function iso(mixed $value): ?string
    {
        return $value === null ? null : Carbon::parse($value)->toIso8601String();
    }

    // ---- storage ------------------------------------------------------

    private function db(): ConnectionInterface
    {
        return DB::connection(AgentBusTablesMaps::connection());
    }

    private function table(string $key): Builder
    {
        return $this->db()->table(AgentBusTablesMaps::getTableName($key));
    }
}
