package com.escodro.navigationapi.event

import com.escodro.navigationapi.destination.Destination
import com.escodro.navigationapi.destination.WordFlowDestination

/**
 * WordFlow navigation events.
 */
object WordFlowEvent {
    data object OnLoginClick : Event {
        override fun nextDestination(): Destination = WordFlowDestination.Login
    }

    data object OnDashboardClick : Event {
        override fun nextDestination(): Destination = WordFlowDestination.Dashboard
    }

    data object OnCoursesClick : Event {
        override fun nextDestination(): Destination = WordFlowDestination.Courses
    }

    data class OnCourseClick(val groupId: String) : Event {
        override fun nextDestination(): Destination = WordFlowDestination.CourseDetail(groupId = groupId)
    }
}

