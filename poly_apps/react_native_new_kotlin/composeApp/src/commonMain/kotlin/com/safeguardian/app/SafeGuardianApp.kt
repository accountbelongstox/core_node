package com.safeguardian.app

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.PhoneIphone
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Smartphone
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.takeOrElse

@Composable
fun SafeGuardianApp(state: AppState? = null) {
    val appState = state ?: remember { AppState() }
    SafeGuardianTheme(themeMode = appState.themeMode) {
        Surface(modifier = Modifier.fillMaxSize()) {
            if (appState.isAuthenticated) {
                MainScreen(appState)
            } else {
                LoginScreen(appState)
            }
        }
    }
}

@Composable
private fun LoginScreen(appState: AppState) {
    var phone by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var showForm by remember { mutableStateOf(false) }
    var isLogin by remember { mutableStateOf(true) }

    val holographic = Brush.linearGradient(
        0f to Color(0xFFe0f2fe),
        0.25f to Color(0xFF3b82f6),
        0.5f to Color(0xFFFFFFFF),
        0.75f to Color(0xFF8b5cf6),
        1f to Color(0xFFec4899)
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(holographic)
            .padding(horizontal = 18.dp, vertical = 12.dp)
    ) {
        if (showForm) {
            LoginForm(
                appState = appState,
                phone = phone,
                code = code,
                isLogin = isLogin,
                onBack = { showForm = false },
                onPhoneChange = { phone = it },
                onCodeChange = { code = it },
                onSubmit = { appState.login(phone) },
                onToggleMode = { isLogin = !isLogin }
            )
        } else {
            LoginWelcome(
                appState = appState,
                onPrimary = { showForm = true },
                onSocial = { /* placeholder for third party login */ }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainScreen(appState: AppState) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val friendDetail = appState.focusedFriend

    Scaffold(
        bottomBar = {
            NavigationBar {
                MainTab.values().forEach { tab ->
                    NavigationBarItem(
                        selected = appState.selectedTab == tab,
                        onClick = { appState.selectTab(tab) },
                        icon = {
                            when (tab) {
                                MainTab.MAP -> androidx.compose.material3.Icon(
                                    Icons.Outlined.Map,
                                    contentDescription = null
                                )
                                MainTab.FRIENDS -> androidx.compose.material3.Icon(
                                    Icons.Outlined.FavoriteBorder,
                                    contentDescription = null
                                )
                                MainTab.SHOP -> androidx.compose.material3.Icon(
                                    Icons.Outlined.ShoppingCart,
                                    contentDescription = null
                                )
                                MainTab.PROFILE -> androidx.compose.material3.Icon(
                                    Icons.Outlined.Person,
                                    contentDescription = null
                                )
                            }
                        },
                        label = { Text(appState.t(tab.titleKey)) }
                    )
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (appState.selectedTab) {
                MainTab.MAP -> MapTab(appState)
                MainTab.FRIENDS -> FriendsTab(appState)
                MainTab.SHOP -> ShopTab(appState)
                MainTab.PROFILE -> ProfileTab(appState)
            }

            if (friendDetail != null) {
                ModalBottomSheet(
                    onDismissRequest = { appState.closeFriend() },
                    sheetState = sheetState
                ) {
                    FriendDetailSheet(friendDetail, appState)
                }
            }
        }
    }
}

@Composable
private fun MapTab(appState: AppState) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = appState.t("tab.map"),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1.2f),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFEAF4FF)),
            shape = RoundedCornerShape(22.dp)
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                val accent = MaterialTheme.colorScheme.primary
                Canvas(modifier = Modifier.fillMaxSize()) {
                    drawRect(color = Color(0xFFdbeafe))
                    drawCircle(color = accent, radius = size.minDimension * 0.12f, center = center)
                }
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = appState.t("login.subtitle"),
                        style = MaterialTheme.typography.titleMedium,
                        color = Color(0xFF0f172a)
                    )
                    Text(
                        text = "Live monitoring: ${appState.friends.count { it.isMonitored }} contact(s)",
                        color = Color(0xFF1e293b)
                    )
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            StatChip(
                icon = Icons.Outlined.PhoneIphone,
                title = "SOS Relay",
                value = "Ready"
            )
            StatChip(
                icon = Icons.Outlined.QrCode2,
                title = "Trackers",
                value = "${appState.friends.size}"
            )
        }
        Text(
            text = "Tap a friend to view location and vitals.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun FriendsTab(appState: AppState) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = appState.t("tab.friends"),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
        }
        items(appState.friends, key = { it.base.id }) { friend ->
            FriendCard(friend = friend, onClick = { appState.openFriend(friend) })
        }
    }
}

@Composable
private fun FriendCard(friend: Friend, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column {
                    Text(friend.base.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(4.dp))
                    Text(friend.location.address, style = MaterialTheme.typography.bodyMedium)
                }
                MonitorPill(active = friend.isMonitored)
            }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text("Steps: ${friend.health?.steps ?: "--"}")
                Text("Network: ${friend.device?.network ?: "--"}")
                Text("Last: ${friend.lastActive}")
            }
        }
    }
}
@Composable
private fun FriendDetailSheet(friend: Friend, appState: AppState) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(friend.base.name, style = MaterialTheme.typography.headlineSmall)
        Text(friend.location.address, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Last message: ${friend.chat?.lastMessage ?: "--"}")
        Text("Heart rate: ${friend.health?.heartRate ?: "--"} bpm")
        Text("Usage today: ${friend.device?.usageTime ?: "--"}")
        Button(onClick = { appState.toggleMonitor(friend) }) {
            Text(if (friend.isMonitored) "Disable Monitoring" else "Enable Monitoring")
        }
    }
}

@Composable
private fun ShopTab(appState: AppState) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = appState.t("tab.shop"),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
        }
        items(appState.products, key = { it.id }) { product ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(product.nameEn, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(4.dp))
                    Text(product.description ?: "", maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(8.dp))
                    Text("${product.priceLabel} • ${product.distance}")
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = {}) {
                        Text(appState.t("shop.buy"))
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileTab(appState: AppState) {
    val user = appState.user ?: return

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = appState.t("tab.me"),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Card {
            Column(Modifier.padding(16.dp)) {
                Text(user.name, style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.height(4.dp))
                Text(user.phone)
                user.signature?.let {
                    Spacer(Modifier.height(4.dp))
                    Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(appState.t("me.theme"))
            Switch(
                checked = appState.themeMode == ThemeMode.DARK,
                onCheckedChange = { appState.toggleTheme() }
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(appState.t("me.lang"))
            Row {
                Language.values().forEach { lang ->
                    TextButton(onClick = { appState.updateLanguage(lang) }) {
                        Text(
                            lang.name,
                            fontWeight = if (appState.language == lang) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        OutlinedButton(
            onClick = { appState.logout() },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(appState.t("profile.logout"))
        }
    }
}

@Composable
private fun MonitorPill(active: Boolean) {
    val colors = if (active) listOf(Color(0xFF22c55e), Color(0xFF16a34a)) else listOf(
        Color(0xFFe2e8f0),
        Color(0xFFcbd5e1)
    )
    Box(
        modifier = Modifier
            .background(Brush.horizontalGradient(colors), RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Text(if (active) "Monitoring" else "Standby", color = if (active) Color.White else Color(0xFF475569))
    }
}

@Composable
private fun RowScope.StatChip(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, value: String) {
    Card(
        modifier = Modifier
            .weight(1f)
            .fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(14.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Column {
                Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun LoginWelcome(appState: AppState, onPrimary: () -> Unit, onSocial: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.padding(top = 40.dp, start = 6.dp)) {
            GradientText(appState.t("login.welcome"), MaterialTheme.typography.headlineLarge)
            Spacer(Modifier.height(6.dp))
            Text(
                text = appState.t("login.subtitle"),
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Black),
                color = Color(0xFF0f172a)
            )
        }

        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(160.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.7f))
                    .border(1.dp, Color(0xFFdbeafe), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Outlined.Smartphone, contentDescription = null, tint = Color(0xFF3b82f6), modifier = Modifier.size(64.dp))
            }
            Spacer(Modifier.height(28.dp))
            GradientButton(
                label = appState.t("login.btn"),
                onClick = onPrimary,
                icon = Icons.Outlined.PhoneIphone
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = appState.t("login.agree"),
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF1e293b)
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(appState.t("login.other"), color = Color(0xFF64748b))
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                SocialIcon(label = appState.t("login.wechat"), onClick = onSocial, color = Color(0xFF22c55e))
                SocialIcon(label = appState.t("login.qq"), onClick = onSocial, color = Color(0xFF3b82f6))
                SocialIcon(label = appState.t("login.alipay"), onClick = onSocial, color = Color(0xFFf59e0b))
            }
        }
    }
}

@Composable
private fun LoginForm(
    appState: AppState,
    phone: String,
    code: String,
    isLogin: Boolean,
    onBack: () -> Unit,
    onPhoneChange: (String) -> Unit,
    onCodeChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onToggleMode: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(24.dp))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Outlined.ArrowBack,
                contentDescription = null,
                modifier = Modifier
                    .size(28.dp)
                    .clickable { onBack() }
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = if (isLogin) appState.t("login.login") else appState.t("login.register"),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        }
        Text(
            text = if (isLogin) appState.t("login.loginSubtitle") else appState.t("login.registerSubtitle"),
            color = Color(0xFF64748b)
        )
        OutlinedTextField(
            value = phone,
            onValueChange = onPhoneChange,
            label = { Text(appState.t("login.phone")) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        OutlinedTextField(
            value = code,
            onValueChange = onCodeChange,
            label = { Text(appState.t("login.code")) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        GradientButton(
            label = if (isLogin) appState.t("login.login") else appState.t("login.register"),
            onClick = onSubmit
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (isLogin) appState.t("login.noAccount") else appState.t("login.hasAccount"),
                color = Color(0xFF475569)
            )
            TextButton(onClick = onToggleMode) {
                Text(text = if (isLogin) appState.t("login.register") else appState.t("login.login"))
            }
        }
    }
}

@Composable
private fun GradientButton(label: String, onClick: () -> Unit, icon: androidx.compose.ui.graphics.vector.ImageVector? = null) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(
                Brush.horizontalGradient(
                    listOf(Color(0xFF3b82f6), Color(0xFF06b6d4), Color(0xFF8b5cf6))
                )
            )
            .clickable { onClick() }
            .padding(vertical = 16.dp, horizontal = 18.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = Color.White)
            }
            Text(label, color = Color.White, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun GradientText(text: String, style: TextStyle) {
    Text(
        text = text,
        style = style.copy(
            fontWeight = FontWeight.ExtraBold,
            fontSize = style.fontSize.takeOrElse { 36.sp },
            brush = Brush.linearGradient(
                listOf(Color(0xFF1e293b), Color(0xFF8b5cf6))
            )
        )
    )
}

@Composable
private fun SocialIcon(label: String, onClick: () -> Unit, color: Color) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .size(60.dp)
                .clip(CircleShape)
                .background(color.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Outlined.Smartphone,
                contentDescription = null,
                tint = color
            )
        }
        Text(label, color = Color(0xFF1e293b), style = MaterialTheme.typography.labelMedium)
    }
}
