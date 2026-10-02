<?php

namespace App\Apps\AgentBus\AgentBusMcp;

use App\Apps\AgentBus\AgentBusServices\AgentBusContract;
use Laravel\Mcp\Server;

/** Stateless Streamable HTTP MCP server: every POST is answered with one JSON body, no SSE. */
final class AgentBusMcpServer extends Server
{
    public int $maxPaginationLength = 100;

    public int $defaultPaginationLength = 100;

    protected function boot(): void
    {
        $this->name = (string) AgentBusContract::get('server_name');
        $this->version = (string) AgentBusContract::get('server_version');
        $this->instructions = __('agent_bus.mcp_instructions');
        $this->tools = array_map(
            static fn (array $operation): AgentBusMcpTool => new AgentBusMcpTool($operation),
            AgentBusContract::operations()
        );
    }
}
