package com.escodro.router

import com.arkivanov.decompose.ComponentContext
import com.arkivanov.decompose.router.stack.ChildStack
import com.arkivanov.decompose.router.stack.StackNavigation
import com.arkivanov.decompose.router.stack.bringToFront
import com.arkivanov.decompose.router.stack.childStack
import com.arkivanov.decompose.router.stack.pop
import com.arkivanov.decompose.router.stack.push
import com.arkivanov.decompose.router.stack.replaceAll
import com.arkivanov.decompose.value.Value

/**
 * Implementation of [AppRouter] using Decompose ChildStack.
 * 
 * Based on Decompose 3.4.0 API.
 * See: https://arkivanov.github.io/Decompose/getting-started/installation/
 */
class AppRouterImpl(
    componentContext: ComponentContext,
    initialScreen: Screen = Screen.Home,
) : AppRouter, ComponentContext by componentContext {

    private val navigation = StackNavigation<Screen>()

    override val stack: Value<ChildStack<*, Screen>> =
        childStack(
            source = navigation,
            serializer = Screen.serializer(),
            initialConfiguration = initialScreen,
            handleBackButton = true,
            childFactory = { _, screen -> screen },
        )

    override fun navigateTo(screen: Screen, replaceCurrent: Boolean) {
        if (replaceCurrent) {
            // Replace current: pop current and push new
            if (stack.value.backStack.isNotEmpty()) {
                navigation.pop()
            }
            navigation.push(screen)
        } else {
            navigation.push(screen)
        }
    }

    override fun navigateBack(): Boolean {
        return if (stack.value.backStack.isNotEmpty()) {
            navigation.pop()
            true
        } else {
            false
        }
    }

    override fun navigateBackTo(screen: Screen): Boolean {
        return try {
            navigation.bringToFront(screen)
            true
        } catch (e: Exception) {
            false
        }
    }

    override fun navigateToRoot(screen: Screen) {
        navigation.replaceAll(screen)
    }
}

