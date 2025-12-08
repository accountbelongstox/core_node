package com.escodro.wordflow.model

/**
 * Represents a word in the learning system.
 */
data class Word(
    val id: String,
    val text: String,
    val phonetic: String,
    val translation: String,
    val definition: String? = null,
    val example: String,
    val exampleTranslation: String? = null,
    val masteryLevel: Int, // 0-100
    val lastReview: String? = null,
    val nextReview: String? = null,
    val tags: List<String> = emptyList(),
    val audioUrl: String? = null,
)












