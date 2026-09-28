<?php

namespace App\Ai\Agents;

use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\Conversational;
use Laravel\Ai\Contracts\HasProviderOptions;
use Laravel\Ai\Concerns\RemembersConversations;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;

/**
 * GatewayChatAgent — the official Laravel AI SDK agent behind the AI
 * Management chat interface.
 *
 * One agent covers every SDK provider defined in config/ai.php: the provider
 * is chosen per prompt (a string pins one provider, an array engages the
 * SDK's native failover). Conversations persist through
 * RemembersConversations (agent_conversations tables), and Anthropic-bound
 * dispatches carry the official ephemeral cache_control provider option, so
 * repeated prefixes are served from the provider-side prompt cache and
 * reported back as usage cache tokens.
 */
class GatewayChatAgent implements Agent, Conversational, HasProviderOptions
{
    use Promptable;
    use RemembersConversations;

    /**
     * Get the instructions that the agent should follow.
     */
    public function instructions(): Stringable|string
    {
        return 'You are the laravel_main AI gateway assistant. Answer concisely and accurately.';
    }

    /**
     * Get provider-specific generation options.
     *
     * @return array<string, mixed>
     */
    public function providerOptions(Lab|string $provider): array
    {
        $driver = $provider instanceof Lab ? $provider->value : (string) $provider;

        return match ($driver) {
            // Official Anthropic prompt caching — reused prefixes are billed as
            // cache reads and surface as cache tokens in the response usage.
            Lab::Anthropic->value => ['cache_control' => ['type' => 'ephemeral']],
            default => [],
        };
    }
}
