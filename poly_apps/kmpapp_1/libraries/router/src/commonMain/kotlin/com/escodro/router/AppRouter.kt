package com.escodro.router

import com.arkivanov.decompose.router.stack.ChildStack
import com.arkivanov.decompose.value.Value

/**
 * Application router interface.
 */
interface AppRouter {
    /**
     * Current navigation stack state.
     */
    val stack: Value<ChildStack<*, Screen>>

    /**
     * Navigate to a screen.
     *
     * @param screen the target screen
     * @param replaceCurrent whether to replace the current screen instead of pushing
     */
    fun navigateTo(screen: Screen, replaceCurrent: Boolean = false)

    /**
     * Navigate back.
     *
     * @return true if navigation was successful, false if there's nothing to pop
     */
    fun navigateBack(): Boolean

    /**
     * Navigate back to a specific screen.
     *
     * @param screen the target screen to navigate back to
     * @return true if navigation was successful, false if screen not found in stack
     */
    fun navigateBackTo(screen: Screen): Boolean

    /**
     * Clear the navigation stack and navigate to a screen.
     *
     * @param screen the target screen
     */
    fun navigateToRoot(screen: Screen)
}

