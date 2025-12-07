package com.escodro.router

import androidx.compose.runtime.Composable
import com.arkivanov.decompose.extensions.compose.stack.Children
import com.arkivanov.decompose.extensions.compose.stack.animation.fade
import com.arkivanov.decompose.extensions.compose.stack.animation.plus
import com.arkivanov.decompose.extensions.compose.stack.animation.scale
import com.arkivanov.decompose.extensions.compose.stack.animation.stackAnimation
import com.arkivanov.decompose.extensions.compose.subscribeAsState

/**
 * Router content composable that handles screen navigation with animations.
 * 
 * Based on Decompose 3.4.0 API.
 * See: https://arkivanov.github.io/Decompose/getting-started/installation/
 *
 * @param router the application router
 * @param content the content composable for each screen
 */
@Composable
fun RouterContent(
    router: AppRouter,
    content: @Composable (screen: Screen) -> Unit,
) {
    val stack = router.stack.subscribeAsState()

    Children(
        stack = stack.value,
        animation = stackAnimation(fade() + scale()),
    ) { child ->
        content(child.instance)
    }
}

