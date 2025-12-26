package com.escodro.shareapi

/**
 * Interface for sharing content across platforms.
 */
interface ShareManager {
    /**
     * Shares the given content.
     *
     * @param content the content to share
     */
    suspend fun share(content: ShareContent)
}

