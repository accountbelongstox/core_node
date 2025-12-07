package com.safeguardian.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class AppState {
    var language by mutableStateOf(Language.EN)
        private set

    var themeMode by mutableStateOf(ThemeMode.LIGHT)
        private set

    var user by mutableStateOf<User?>(null)
        private set

    var selectedTab by mutableStateOf(MainTab.FRIENDS)
        private set

    var focusedFriend by mutableStateOf<Friend?>(null)
        private set

    val friends = mutableStateListOf<Friend>()
    val products = mutableStateListOf<Product>()

    init {
        friends.addAll(mockFriends)
        products.addAll(mockProducts)
    }

    val isAuthenticated: Boolean
        get() = user != null

    fun login(phone: String) {
        val suffix = phone.takeLast(4).padStart(4, '0')
        user = mockUser.copy(
            phone = if (phone.isBlank()) mockUser.phone else phone,
            name = "User $suffix",
        )
    }

    fun logout() {
        user = null
        selectedTab = MainTab.FRIENDS
        focusedFriend = null
    }

    fun toggleTheme() {
        themeMode = if (themeMode == ThemeMode.LIGHT) ThemeMode.DARK else ThemeMode.LIGHT
    }

    fun updateLanguage(target: Language) {
        language = target
    }

    fun t(key: String): String = translations[language]?.get(key) ?: key

    fun selectTab(tab: MainTab) {
        selectedTab = tab
        focusedFriend = null
    }

    fun openFriend(friend: Friend) {
        focusedFriend = friend
    }

    fun closeFriend() {
        focusedFriend = null
    }

    fun toggleMonitor(friend: Friend) {
        val index = friends.indexOfFirst { it.base.id == friend.base.id }
        if (index >= 0) {
            friends[index] = friends[index].copy(isMonitored = !friends[index].isMonitored)
            if (focusedFriend?.base?.id == friend.base.id) {
                focusedFriend = friends[index]
            }
        }
    }
}

private val mockUser = User(
    id = "u1",
    name = "Alex Chen",
    phone = "13800138000",
    avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
    signature = "Stay safe, stay connected.",
    gender = "male",
    address = "Beijing, China",
    email = "alex@example.com",
    idCard = "11010119900101****",
)

private val mockFriends = listOf(
    Friend(
        base = User(
            id = "f1",
            name = "Sarah",
            phone = "13900000000",
            avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
            gender = "female",
            signature = "Here for you.",
        ),
        relation = "Partner",
        daysConnected = 1314,
        lastActive = "Just now",
        isMonitored = true,
        location = Location(
            lat = 39.9042,
            lng = 116.4074,
            address = "Palace Museum",
        ),
        health = HealthStats(steps = 8432, heartRate = 78, temperature = 36.5),
        device = DeviceStats(network = "5G", unlocks = 42, usageTime = "4h 15m"),
        chat = ChatPreview(
            lastMessage = "Are you coming home for dinner?",
            unreadCount = 3,
            lastMessageTime = "10:45 AM",
        ),
    ),
    Friend(
        base = User(
            id = "f2",
            name = "Mom",
            phone = "13700000000",
            avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=Mom",
            gender = "female",
            signature = "Stay warm!",
        ),
        relation = "Parent",
        daysConnected = 520,
        lastActive = "10 min ago",
        isMonitored = false,
        location = Location(
            lat = 39.9142,
            lng = 116.4174,
            address = "Home",
        ),
        health = HealthStats(steps = 1200, heartRate = 82, temperature = 36.6),
        device = DeviceStats(network = "WiFi", unlocks = 10, usageTime = "1h 00m"),
        chat = ChatPreview(
            lastMessage = "Remember to wear a jacket.",
            unreadCount = 0,
            lastMessageTime = "Yesterday",
        ),
    ),
)

private val mockProducts = listOf(
    Product(
        id = "p1",
        name = "†r%‘-ÿ†¨‘%<Š­\"‡%^",
        nameEn = "SafeGuardian Watch Edition",
        priceLabel = "A299",
        price = 299,
        distance = "1.2km",
        rating = 4.8,
        category = "wearable",
        description = "Flagship guardian wearable with fall detection and SOS relay.",
    ),
    Product(
        id = "p2",
        name = "†`\"Š_1‘O,„¯",
        nameEn = "Safety Accessories",
        priceLabel = "A89",
        price = 89,
        distance = "0.8km",
        rating = 4.6,
        category = "accessory",
        description = "Companion tags for quick pairing and geofencing.",
    ),
    Product(
        id = "p3",
        name = "†¨Ÿ‡ZØ†?†§ú‡>`‘Z",
        nameEn = "Heart Rate Monitor",
        priceLabel = "A199",
        price = 199,
        distance = "2.5km",
        rating = 4.9,
        category = "health",
        description = "24/7 vitals with predictive alerts for the whole family.",
    ),
)
