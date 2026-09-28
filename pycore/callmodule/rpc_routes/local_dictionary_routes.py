# -*- coding: utf-8 -*-
"""HTTP Routes for dictionary."""


from pycore.callmodule.rpc_routes.route_names import (
    UI_DICTIONARY_DICTIONARY_STATUS,
    UI_DICTIONARY_DICTIONARY_LOOKUP,
    UI_DICTIONARY_DICTIONARY_MATCH,
)
from pycore.pyutils.translator.dictionary import dictionary_service


def register_local_dictionary_routes(server):
    def dictionary_status_handler(params, request_id, context):
        def _run():
            status = dictionary_service.status()
            return {"success": True, **status}

        return _run()

    server.post(path=UI_DICTIONARY_DICTIONARY_STATUS, handler=dictionary_status_handler)

    def dictionary_lookup_handler(params, request_id, context):

        def _run():
            svc = dictionary_service
            word = str(params.get("word") or "").strip()
            target = str(params.get("target") or "zh")
            if not word:
                return {"success": False, "error": "word is required", "found": False}
            entry = svc.lookup(word)
            entry["success"] = True
            entry["target"] = target
            entry["target_translation"] = svc.translate(word, target)
            return entry

        return _run()

    server.post(path=UI_DICTIONARY_DICTIONARY_LOOKUP, handler=dictionary_lookup_handler)

    def dictionary_match_handler(params, request_id, context):
        def _run():
            prefix = str(params.get("prefix") or params.get("word") or "").strip()
            try:
                limit = int(params.get("limit") or 20)
            except (TypeError, ValueError):
                limit = 20
            result = dictionary_service.match(prefix, limit)
            result["success"] = True
            return result

        return _run()

    server.post(path=UI_DICTIONARY_DICTIONARY_MATCH, handler=dictionary_match_handler)

