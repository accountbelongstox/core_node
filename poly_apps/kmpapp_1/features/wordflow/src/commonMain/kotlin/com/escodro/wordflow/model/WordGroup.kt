package com.escodro.wordflow.model

/**
 * Represents a word group/course.
 */
data class WordGroup(
    val id: String,
    val name: String,
    val count: Int,
    val type: WordGroupType,
    val progress: Int,
    val coverImage: String? = null,
    val language: String, // e.g., 'en', 'jp'
    val description: String? = null,
)

enum class WordGroupType {
    SYSTEM,
    USER,
    DOCUMENT,
}

