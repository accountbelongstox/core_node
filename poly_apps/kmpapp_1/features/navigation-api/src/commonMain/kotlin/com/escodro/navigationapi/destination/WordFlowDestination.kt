package com.escodro.navigationapi.destination

import kotlinx.serialization.Serializable

/**
 * WordFlow navigation destinations.
 */
object WordFlowDestination {
    @Serializable
    data object Login : Destination

    @Serializable
    data object Dashboard : Destination

    @Serializable
    data object Courses : Destination

    @Serializable
    data class CourseDetail(val groupId: String) : Destination
}

