package com.escodro.wordflow.presentation.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Dashboard/Home screen for WordFlow.
 */
@Composable
fun DashboardScreen(
    userName: String? = null,
    activeGroupName: String? = null,
    activeGroupProgress: Int = 0,
    onNavigateToCourses: () -> Unit = {},
    onNavigateToPlaylist: () -> Unit = {},
    onNavigateToFlashcards: () -> Unit = {},
    onNavigateToReading: () -> Unit = {},
    onNavigateToQuiz: () -> Unit = {},
    onNavigateToListening: () -> Unit = {},
    onNavigateToSettings: () -> Unit = {},
    onNavigateToLanguageSettings: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 24.dp),
    ) {
        // Welcome Section
        Column(modifier = Modifier.padding(bottom = 24.dp)) {
            Text(
                text = if (userName != null) "START LEARNING" else "Guest Mode",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                modifier = Modifier.padding(bottom = 4.dp),
            )
            Text(
                text = if (userName != null) "Hi, ${userName.split(' ').firstOrNull() ?: userName}" else "Welcome Guest",
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                style = MaterialTheme.typography.headlineLarge,
            )
        }

        // Language Selection Bar
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.5f),
            ),
            shape = RoundedCornerShape(16.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "🇺🇸",
                        fontSize = 24.sp,
                        modifier = Modifier.padding(end = 12.dp),
                    )
                    Column {
                        Text(
                            text = "TARGET LANGUAGE",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                        )
                        Text(
                            text = "English",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Icon(
                    imageVector = Icons.Outlined.Settings,
                    contentDescription = "Settings",
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onNavigateToLanguageSettings() }
                        .padding(8.dp),
                )
            }
        }

        // Library / Active Course Section
        Column(modifier = Modifier.padding(bottom = 32.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = if (userName != null) "MY COURSE" else "LIBRARY",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                )
                if (userName != null) {
                    Text(
                        text = "+ Add",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable { onNavigateToCourses() },
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (userName != null && activeGroupName != null) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToCourses() },
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                    ),
                    shape = RoundedCornerShape(32.dp),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(
                                        Brush.linearGradient(
                                            colors = listOf(
                                                MaterialTheme.colorScheme.primaryContainer,
                                                MaterialTheme.colorScheme.secondaryContainer,
                                            ),
                                        ),
                                    ),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(text = "📚", fontSize = 24.sp)
                            }
                            Spacer(modifier = Modifier.width(16.dp))
                            Column {
                                Text(
                                    text = activeGroupName,
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .width(96.dp)
                                            .height(6.dp)
                                            .clip(RoundedCornerShape(3.dp))
                                            .background(MaterialTheme.colorScheme.surfaceVariant),
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth(activeGroupProgress / 100f)
                                                .fillMaxSize()
                                                .background(MaterialTheme.colorScheme.primary),
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "$activeGroupProgress%",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                    )
                                }
                            }
                        }
                        Icon(
                            imageVector = Icons.Outlined.Settings,
                            contentDescription = "Navigate",
                            modifier = Modifier.size(40.dp),
                        )
                    }
                }
            } else {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToCourses() },
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                    ),
                    shape = RoundedCornerShape(32.dp),
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(text = "📚", fontSize = 48.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Select a Word Bank to Start",
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Login Required",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                        )
                    }
                }
            }
        }

        // Study Modes Grid
        Text(
            text = "STUDY CENTER",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
            modifier = Modifier.padding(bottom = 16.dp),
        )

        // Playlist Mode (Full Width)
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp)
                .clickable { onNavigateToPlaylist() },
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primary,
            ),
            shape = RoundedCornerShape(20.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        text = "RECOMMENDED",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f),
                        modifier = Modifier
                            .padding(bottom = 8.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.2f))
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                    )
                    Text(
                        text = "Smart Playlist",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Text(
                        text = "Auto-play & Instant Review",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f),
                    )
                }
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(28.dp))
                        .background(MaterialTheme.colorScheme.onPrimary),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = if (userName != null) "▶" else "🔒",
                        fontSize = 24.sp,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }

        // Other Study Modes (Grid)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            StudyModeCard(
                title = "Flashcards",
                subtitle = "Spaced Repetition",
                icon = "Aa",
                modifier = Modifier.weight(1f),
                onClick = onNavigateToFlashcards,
                isLocked = userName == null,
            )
            StudyModeCard(
                title = "Reading",
                subtitle = "Flow Context",
                icon = "📖",
                modifier = Modifier.weight(1f),
                onClick = onNavigateToReading,
                isLocked = userName == null,
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            StudyModeCard(
                title = "Quiz",
                subtitle = "Gamified Test",
                icon = "?",
                modifier = Modifier.weight(1f),
                onClick = onNavigateToQuiz,
                isLocked = userName == null,
            )
            StudyModeCard(
                title = "Passive",
                subtitle = "Audio Loop",
                icon = "🎧",
                modifier = Modifier.weight(1f),
                onClick = onNavigateToListening,
                isLocked = userName == null,
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Progress Section
        Text(
            text = "MY PROGRESS",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
            modifier = Modifier.padding(bottom = 16.dp),
        )

        if (userName != null) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                ProgressCard(
                    emoji = "🔥",
                    value = "0 Days",
                    label = "Current Streak",
                    modifier = Modifier.weight(1f),
                )
                ProgressCard(
                    emoji = "🧠",
                    value = "85%",
                    label = "Retention Rate",
                    modifier = Modifier.weight(1f),
                )
            }
        } else {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                ),
                shape = RoundedCornerShape(32.dp),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = "Sync Your Progress",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                    Text(
                        text = "Login to save your streaks, vocabulary lists, and mastery levels across devices.",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                        modifier = Modifier.padding(bottom = 24.dp),
                    )
                    // Login button would go here
                }
            }
        }
    }
}

@Composable
private fun StudyModeCard(
    title: String,
    subtitle: String,
    icon: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    isLocked: Boolean = false,
) {
    Card(
        modifier = modifier
            .height(120.dp)
            .clickable { onClick() },
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = icon, fontSize = 20.sp)
            }
            Column {
                Text(
                    text = title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = subtitle,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                )
            }
            if (isLocked) {
                Text(
                    text = "🔒",
                    fontSize = 16.sp,
                    modifier = Modifier.align(Alignment.End),
                )
            }
        }
    }
}

@Composable
private fun ProgressCard(
    emoji: String,
    value: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            Text(text = emoji, fontSize = 32.sp, modifier = Modifier.padding(bottom = 8.dp))
            Text(
                text = value,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = label,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
            )
        }
    }
}

