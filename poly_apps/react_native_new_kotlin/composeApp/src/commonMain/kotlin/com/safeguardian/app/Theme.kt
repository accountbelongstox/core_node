package com.safeguardian.app

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme()
private val DarkColors = darkColorScheme()

@Composable
fun SafeGuardianTheme(themeMode: ThemeMode, content: @Composable () -> Unit) {
    val colors = if (themeMode == ThemeMode.DARK) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, content = content)
}
