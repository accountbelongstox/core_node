package com.safeguardian.app

import androidx.compose.runtime.Immutable

enum class Language {
    EN,
    ZH,
}

enum class ThemeMode {
    LIGHT,
    DARK,
}

enum class MainTab(val titleKey: String, val icon: String) {
    MAP("tab.map", "Map"),
    FRIENDS("tab.friends", "Heart"),
    SHOP("tab.shop", "ShoppingCart"),
    PROFILE("tab.me", "User"),
}

@Immutable
data class User(
    val id: String,
    val name: String,
    val phone: String,
    val avatar: String,
    val signature: String? = null,
    val gender: String? = null,
    val address: String? = null,
    val email: String? = null,
    val idCard: String? = null,
)

@Immutable
data class Location(
    val lat: Double,
    val lng: Double,
    val address: String,
)

@Immutable
data class HealthStats(
    val steps: Int,
    val heartRate: Int,
    val temperature: Double,
)

@Immutable
data class DeviceStats(
    val network: String,
    val unlocks: Int,
    val usageTime: String,
)

@Immutable
data class ChatPreview(
    val lastMessage: String,
    val unreadCount: Int,
    val lastMessageTime: String,
)

@Immutable
data class Friend(
    val base: User,
    val relation: String,
    val daysConnected: Int,
    val lastActive: String,
    val isMonitored: Boolean,
    val location: Location,
    val health: HealthStats?,
    val device: DeviceStats?,
    val chat: ChatPreview?,
)

@Immutable
data class Product(
    val id: String,
    val name: String,
    val nameEn: String,
    val priceLabel: String,
    val price: Int,
    val distance: String,
    val rating: Double,
    val category: String,
    val description: String?,
)
