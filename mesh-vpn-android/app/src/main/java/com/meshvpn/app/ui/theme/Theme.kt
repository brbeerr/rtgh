package com.meshvpn.app.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF00D4AA),
    secondary = Color(0xFF4FC3F7),
    tertiary = Color(0xFFFFB74D),
    background = Color(0xFF0F1923),
    surface = Color(0xFF1A2634),
    surfaceVariant = Color(0xFF243447),
    onPrimary = Color.Black,
    onSecondary = Color.Black,
    onBackground = Color(0xFFE8EAED),
    onSurface = Color(0xFFE8EAED),
    error = Color(0xFFF44336)
)

@Composable
fun MeshVpnTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
