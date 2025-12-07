package com.escodro.shareapi

import android.content.Context

/**
 * Factory for creating platform-specific [ShareManager] instances.
 */
fun createShareManager(context: Context): ShareManager = AndroidShareManager(context)

