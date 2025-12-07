package com.escodro.wordflow.navigation

import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.toRoute
import com.escodro.designsystem.animation.SlideInHorizontallyTransition
import com.escodro.designsystem.animation.SlideOutHorizontallyTransition
import com.escodro.navigationapi.controller.NavEventController
import com.escodro.navigationapi.destination.Destination
import com.escodro.navigationapi.destination.WordFlowDestination
import com.escodro.navigationapi.event.Event
import com.escodro.navigationapi.event.WordFlowEvent
import com.escodro.navigationapi.provider.NavGraph
import com.escodro.wordflow.presentation.auth.LoginScreen
import com.escodro.wordflow.presentation.dashboard.DashboardScreen
import com.escodro.wordflow.presentation.library.CourseDetailScreen
import com.escodro.wordflow.presentation.library.CoursesScreen
import com.escodro.wordflow.model.WordGroup
import com.escodro.wordflow.model.CourseAnalysis

internal class WordFlowNavGraph : NavGraph {

    override val navGraph: NavGraphBuilder.(NavEventController) -> Unit = { navEventController ->
        composable<WordFlowDestination.Login> {
            LoginScreen(
                onLogin = { email, password ->
                    // Handle login logic here
                    navEventController.sendEvent(WordFlowEvent.OnDashboardClick)
                },
            )
        }

        composable<WordFlowDestination.Dashboard> {
            DashboardScreen(
                userName = "Demo User", // TODO: Get from state/viewmodel
                activeGroupName = "Sample Course", // TODO: Get from state
                activeGroupProgress = 45, // TODO: Get from state
                onNavigateToCourses = {
                    navEventController.sendEvent(WordFlowEvent.OnCoursesClick)
                },
                onNavigateToPlaylist = {
                    // TODO: Navigate to playlist
                },
                onNavigateToFlashcards = {
                    // TODO: Navigate to flashcards
                },
                onNavigateToReading = {
                    // TODO: Navigate to reading
                },
                onNavigateToQuiz = {
                    // TODO: Navigate to quiz
                },
                onNavigateToListening = {
                    // TODO: Navigate to listening
                },
                onNavigateToSettings = {
                    // TODO: Navigate to settings
                },
                onNavigateToLanguageSettings = {
                    // TODO: Navigate to language settings
                },
            )
        }

        composable<WordFlowDestination.Courses> {
            CoursesScreen(
                groups = emptyList(), // TODO: Get from state/viewmodel
                activeTab = "all",
                tabs = emptyList(), // TODO: Get from state
                activeGroupId = null, // TODO: Get from state
                onTabClick = { /* TODO */ },
                onGroupClick = { groupId ->
                    navEventController.sendEvent(WordFlowEvent.OnCourseClick(groupId))
                },
                onNavigateToUpload = {
                    // TODO: Navigate to upload
                },
                onNavigateToDictionary = {
                    // TODO: Navigate to dictionary
                },
                onNavigateToLanguageSettings = {
                    // TODO: Navigate to language settings
                },
            )
        }

        composable<WordFlowDestination.CourseDetail>(
            enterTransition = { SlideInHorizontallyTransition },
            exitTransition = { SlideOutHorizontallyTransition },
        ) { navEntry ->
            val route: WordFlowDestination.CourseDetail = navEntry.toRoute()
            CourseDetailScreen(
                group = WordGroup(
                    id = route.groupId,
                    name = "Sample Course",
                    count = 1000,
                    type = com.escodro.wordflow.model.WordGroupType.SYSTEM,
                    progress = 45,
                    coverImage = "📚",
                    language = "en",
                    description = "A comprehensive course for learning English vocabulary.",
                ),
                analysis = CourseAnalysis(
                    groupId = route.groupId,
                    totalWords = 1000,
                    knownWords = 450,
                    newWords = 550,
                    estimatedDays = 28,
                    similarity = 45,
                ),
                onBackClick = {
                    navEventController.sendEvent(Event.OnBack)
                },
                onStartLearning = {
                    // TODO: Handle start learning
                    navEventController.sendEvent(WordFlowEvent.OnDashboardClick)
                },
            )
        }
    }
}

