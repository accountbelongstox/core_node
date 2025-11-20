import 'response_parser.dart';

class SchemaRegistry {
  final _parsers = <String, ResponseParser>{};
  final _schemas = <String, Map<String, dynamic>>{};

  void register(
      {required String id,
      ResponseParser? parser,
      Map<String, dynamic>? schema}) {
    if (parser != null) {
      _parsers[id] = parser;
    }
    if (schema != null) {
      _schemas[id] = schema;
    }
  }

  ResponseParser? resolveParser(String? id) {
    if (id == null) {
      return null;
    }
    return _parsers[id];
  }

  Map<String, dynamic>? resolveSchema(String? id) {
    if (id == null) {
      return null;
    }
    return _schemas[id];
  }
}
