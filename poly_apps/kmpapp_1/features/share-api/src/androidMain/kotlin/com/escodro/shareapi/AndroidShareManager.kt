package com.escodro.shareapi

import android.content.Context
import android.content.Intent

/**
 * Android implementation of [ShareManager].
 */
internal class AndroidShareManager(
    private val context: Context,
) : ShareManager {

    override suspend fun share(content: ShareContent) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            
            content.text?.let { putExtra(Intent.EXTRA_TEXT, it) }
            content.title?.let { putExtra(Intent.EXTRA_TITLE, it) }
            content.subject?.let { putExtra(Intent.EXTRA_SUBJECT, it) }
            
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }

        val chooserIntent = Intent.createChooser(intent, content.title ?: "Share")
        chooserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        
        context.startActivity(chooserIntent)
    }
}

