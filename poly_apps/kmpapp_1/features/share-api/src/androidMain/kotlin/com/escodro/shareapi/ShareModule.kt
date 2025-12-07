package com.escodro.shareapi

import android.content.Context
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Koin module for share functionality.
 */
fun shareModule(context: Context): Module = module {
    single<ShareManager> { createShareManager(context) }
}

