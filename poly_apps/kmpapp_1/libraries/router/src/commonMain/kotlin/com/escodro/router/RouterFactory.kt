package com.escodro.router

import com.arkivanov.decompose.ComponentContext

/**
 * Factory for creating [AppRouter] instances.
 * 
 * Based on Decompose 3.4.0 API.
 * See: https://arkivanov.github.io/Decompose/getting-started/installation/
 */
object RouterFactory {
    /**
     * Creates a new [AppRouter] instance.
     *
     * @param componentContext the component context
     * @param initialScreen the initial screen (default: [Screen.Home])
     * @return a new [AppRouter] instance
     */
    fun create(
        componentContext: ComponentContext,
        initialScreen: Screen = Screen.Home,
    ): AppRouter = AppRouterImpl(componentContext, initialScreen)
}

