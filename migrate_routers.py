import os
import re
import glob

ROUTERS_DIR = r"d:\programing\core_node\pycore\callmodule\routers"
RPC_ROUTES_DIR = r"d:\programing\core_node\pycore\callmodule\rpc_routes"
ROUTE_NAMES_FILE = os.path.join(RPC_ROUTES_DIR, "route_names.py")
FRONTEND_ROUTES_FILE = r"d:\programing\core_node\poly_apps\pycore_laravel_wordflow_ui\core\api-libs\pycore\PycoreRpcRoutes.ts"
INIT_FILE = os.path.join(RPC_ROUTES_DIR, "__init__.py")

def to_camel_case(snake_str):
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    filename = os.path.basename(filepath)
    if filename == "__init__.py" or not filename.endswith("_router.py"):
        return None

    base_name = filename.replace("_router.py", "")
    new_filename = f"local_{base_name}_routes.py" if "local" in filepath else f"management_{base_name}_routes.py"
    if "local" not in filepath and "management" not in filepath:
        new_filename = f"{base_name}_routes.py"
        
    new_filepath = os.path.join(RPC_ROUTES_DIR, new_filename)

    # Find all endpoints
    endpoints = re.findall(r'@router\.(get|post|delete)\("([^"]+)"\)\s*(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(', content)
    
    if not endpoints:
        return None

    route_names = []
    handlers = []
    
    for method, path, func_name in endpoints:
        route_name_const = f"UI_{base_name.upper()}_{func_name.upper()}"
        route_name_val = f"ui.{base_name}.{func_name}"
        route_names.append((route_name_const, route_name_val))
        
        handlers.append(f"""
    async def {func_name}_handler(params, request_id, context):
        # TODO: Implement native RPC handler for {func_name}
        return {{"success": False, "error": "Not implemented yet"}}
        
    server.route(name={route_name_const}, handler={func_name}_handler, sync=False)
""")

    imports = ",\n    ".join([r[0] for r in route_names])
    
    new_content = f"""# -*- coding: utf-8 -*-
\"\"\"
RPC Routes for {base_name}
\"\"\"

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    {imports}
)

def register_{new_filename.replace('.py', '')}(server):
    \"\"\"Register WS RPC handlers.\"\"\"
    {''.join(handlers)}
    ColorPrint.green("[ConfigBuilder] Registered {base_name} RPC routes")

__all__ = ["register_{new_filename.replace('.py', '')}"]
"""
    
    with open(new_filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    return {
        "old_filepath": filepath,
        "new_filepath": new_filepath,
        "route_names": route_names,
        "register_func": f"register_{new_filename.replace('.py', '')}",
        "module_name": new_filename.replace('.py', '')
    }

def main():
    results = []
    for root, _, files in os.walk(ROUTERS_DIR):
        for file in files:
            if file.endswith("_router.py"):
                res = process_file(os.path.join(root, file))
                if res:
                    results.append(res)
                    
    # Update route_names.py
    with open(ROUTE_NAMES_FILE, 'r', encoding='utf-8') as f:
        route_names_content = f.read()
        
    new_constants = []
    new_exports = []
    for res in results:
        for const, val in res["route_names"]:
            if f'{const} =' not in route_names_content:
                new_constants.append(f'{const} = "{val}"')
                new_exports.append(f'    "{const}",')
                
    if new_constants:
        # Insert before __all__
        parts = route_names_content.split("__all__ = [")
        updated_content = parts[0] + "\n".join(new_constants) + "\n\n__all__ = [\n" + "\n".join(new_exports) + "\n" + parts[1]
        with open(ROUTE_NAMES_FILE, 'w', encoding='utf-8') as f:
            f.write(updated_content)
            
    # Update frontend PycoreRpcRoutes.ts
    with open(FRONTEND_ROUTES_FILE, 'r', encoding='utf-8') as f:
        frontend_content = f.read()
        
    new_frontend_routes = []
    for res in results:
        for const, val in res["route_names"]:
            camel_const = to_camel_case(const.lower().replace('ui_', ''))
            if f"'{val}'" not in frontend_content:
                new_frontend_routes.append(f"  {camel_const}: '{val}',")
                
    if new_frontend_routes:
        parts = frontend_content.split("} as const;")
        updated_frontend = parts[0] + "\n".join(new_frontend_routes) + "\n} as const;" + parts[1]
        with open(FRONTEND_ROUTES_FILE, 'w', encoding='utf-8') as f:
            f.write(updated_frontend)
            
    # Update __init__.py
    with open(INIT_FILE, 'r', encoding='utf-8') as f:
        init_content = f.read()
        
    new_imports = []
    new_init_exports = []
    for res in results:
        mod = res["module_name"]
        func = res["register_func"]
        if f"import {func}" not in init_content:
            new_imports.append(f"from pycore.callmodule.rpc_routes.{mod} import {func}")
            new_init_exports.append(f"    '{func}',")
            
    if new_imports:
        parts = init_content.split("__all__ = [")
        updated_init = parts[0] + "\n".join(new_imports) + "\n\n__all__ = [\n" + "\n".join(new_init_exports) + "\n" + parts[1]
        with open(INIT_FILE, 'w', encoding='utf-8') as f:
            f.write(updated_init)
            
    print(f"Processed {len(results)} files.")

if __name__ == "__main__":
    main()
