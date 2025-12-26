package com.escodro.wordflow.model

/**
 * Analysis data for a course.
 */
data class CourseAnalysis(
    val groupId: String,
    val totalWords: Int,
    val knownWords: Int,
    val newWords: Int,
    val estimatedDays: Int,
    val similarity: Int, // % overlap with user memory
)

