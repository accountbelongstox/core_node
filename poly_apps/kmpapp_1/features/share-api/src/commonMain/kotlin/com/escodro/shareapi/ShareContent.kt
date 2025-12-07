package com.escodro.shareapi

/**
 * Represents content that can be shared.
 */
data class ShareContent(
    val text: String? = null,
    val title: String? = null,
    val subject: String? = null,
    val uri: String? = null,
)

