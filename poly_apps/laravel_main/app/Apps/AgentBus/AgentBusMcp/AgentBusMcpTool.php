<?php

namespace App\Apps\AgentBus\AgentBusMcp;

use App\Apps\AgentBus\AgentBusExceptions\AgentBusException;
use App\Apps\AgentBus\AgentBusServices\AgentBusContract;
use App\Apps\AgentBus\AgentBusServices\AgentBusService;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tool;

/** One MCP tool per contract operation; it calls the same service as the REST route. */
final class AgentBusMcpTool extends Tool
{
    private const READ_ONLY_METHOD = 'GET';

    public function __construct(private readonly array $operation)
    {
        $this->name = $operation['name'];
        $this->title = $operation['name'];
        $this->description = $operation['description'];
    }

    public function handle(Request $request, AgentBusService $bus): Response|ResponseFactory
    {
        $result = [];

        try {
            $result = $bus->call($this->operation['name'], $request->all(), request());
        } catch (AgentBusException $e) {
            return Response::error(json_encode([
                'error_code' => $e->busErrorCode(),
                'message' => $e->getMessage(),
                'status' => $e->getStatusCode(),
                'details' => $e->details(),
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }

        return Response::structured($result);
    }

    public function schema(JsonSchema $schema): array
    {
        $properties = [];
        $type = null;

        foreach ($this->operation['params'] ?? [] as $name => $param) {
            $type = match ($param['type']) {
                'integer' => $schema->integer(),
                'boolean' => $schema->boolean(),
                'array' => $schema->array()->items($schema->string()),
                default => $schema->string(),
            };
            $type = $type->description($param['description']);
            if (isset($param['enum']) || isset($param['enum_ref'])) {
                $type = $type->enum($param['enum'] ?? AgentBusContract::get($param['enum_ref']));
            }
            if (!empty($param['required'])) {
                $type = $type->required();
            }
            $properties[$name] = $type;
        }

        return $properties;
    }

    public function annotations(): array
    {
        return ($this->operation['method'] ?? '') === self::READ_ONLY_METHOD ? ['readOnlyHint' => true] : [];
    }
}
