package com.escodro.router

import kotlinx.serialization.Serializable

/**
 * All application screens for Decompose router.
 */
@Serializable
sealed class Screen {
    // Home screens
    @Serializable
    data object Home : Screen()

    @Serializable
    data object TaskList : Screen()

    @Serializable
    data object Search : Screen()

    @Serializable
    data object CategoryList : Screen()

    @Serializable
    data object Preferences : Screen()

    // Task screens
    @Serializable
    data class TaskDetail(val taskId: Long) : Screen()

    @Serializable
    data object AddTaskBottomSheet : Screen()

    // Category screens
    @Serializable
    data class CategoryBottomSheet(val categoryId: Long?) : Screen()

    // Preference screens
    @Serializable
    data object About : Screen()

    @Serializable
    data object Licenses : Screen()

    @Serializable
    data object Tracker : Screen()

    // WordFlow screens
    @Serializable
    data object WordFlowLogin : Screen()

    @Serializable
    data object WordFlowDashboard : Screen()

    @Serializable
    data object WordFlowCourses : Screen()

    @Serializable
    data class WordFlowCourseDetail(val groupId: String) : Screen()
}

