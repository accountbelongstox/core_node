import 'dart:math';

final _random = Random();

String generateRequestId() {
  final timestamp = DateTime.now().microsecondsSinceEpoch;
  final random = _random.nextInt(1 << 32);
  return 'req-' + timestamp.toString() + '-' + random.toRadixString(16);
}
