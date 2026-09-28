import 'package:hive/hive.dart';

part 'word_card_model.g.dart';

@HiveType(typeId: 0)
class WordCardModel extends HiveObject {
  @HiveField(0)
  final String word;

  @HiveField(1)
  final String translation;

  @HiveField(2)
  final String example;

  @HiveField(3)
  final String imageUrl;

  @HiveField(4)
  final DateTime createdAt;

  WordCardModel({
    required this.word,
    required this.translation,
    required this.example,
    required this.imageUrl,
    required this.createdAt,
  });
}
