package com.escodro.glance.presentation

import android.content.Context
import android.os.Build
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.glance.GlanceTheme
import androidx.glance.LocalContext
import androidx.glance.material3.ColorProviders
import com.escodro.designsystem.theme.QyappDarkColorScheme
import com.escodro.designsystem.theme.QyappLightColorScheme

/**
 * Qyapp Glance Theme.
 * @param context The [LocalContext] of the Glance Widget.
 * @param dynamicColors Determines if the Android 12+ dynamic color is enabled
 * @param content Composable function
 */
@Composable
fun QyappGlanceTheme(
    context: Context = LocalContext.current,
    dynamicColors: Boolean = true,
    content: @Composable () -> Unit,
) {
    val colorProvider = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && dynamicColors) {
        ColorProviders(
            light = dynamicLightColorScheme(context),
            dark = dynamicDarkColorScheme(context),
        )
    } else {
        ColorProviders(
            light = QyappLightColorScheme,
            dark = QyappDarkColorScheme,
        )
    }
    GlanceTheme(colors = colorProvider, content = content)
}
