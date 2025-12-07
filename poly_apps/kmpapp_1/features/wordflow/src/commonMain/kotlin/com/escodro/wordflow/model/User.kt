package com.escodro.wordflow.model

/**
 * Represents a user in the system.
 */
data class User(
    val id: String,
    val name: String,
    val avatar: String,
    val email: String,
    val dailyGoal: Int,
    val dailyProgress: Int,
    val streak: Int,
    val totalLearned: Int,
    val isPro: Boolean,
    val token: String? = null,
    val selectedLanguage: String, // Primary interface language
    val learningLanguages: List<String>, // Array of language codes user is learning
)

