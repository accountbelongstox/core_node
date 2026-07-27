import re

filepath = r"d:\programing\core_node\poly_apps\pycore_laravel_wordflow_ui\core\api-libs\pycore\PycoreApi.ts"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# We need to replace getJSON, postJSON, deleteJSON with callRpc
# We also need to add the corresponding route names to PycoreRpcRoutes.ts and route_names.py
# But since the user asked to "verify if all are using ws and rpc_v2", and I see that getJSON/postJSON
# are actually implemented using WS (getJSONViaWs, postJSONViaWs) in PycoreApi.ts:
# 
# async function getJSONViaWs<T>(url: string): Promise<T> {
#   ...
#   const body = await localHttpGetViaWs<any>(path);
#
# function localHttpGetViaWs<T>(path: string, _timeoutMs?: number): Promise<T> {
#   ...
#   const request = callRpc(PYCORE_RPC_ROUTES.routerInvoke, { route: path, operation: 'read' })
#
# So the frontend IS using WS for all these calls! It's just using the generic `routerInvoke` route
# instead of the specific named routes we just created.
#
# To fully migrate, we should update PycoreApi.ts to use the specific named routes.

print("Frontend is using WS via routerInvoke for getJSON/postJSON.")
