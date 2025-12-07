package com.escodro.qyapp

import android.app.Application
import android.content.Context
import com.escodro.shareapi.shareModule
import com.escodro.shared.di.initKoin
import com.google.android.play.core.splitcompat.SplitCompat
import logcat.AndroidLogcatLogger
import logcat.LogPriority.VERBOSE
import org.koin.dsl.module

/**
 * Qyapp [Application] class.
 */
class QyappApp : Application() {

    override fun onCreate() {
        super.onCreate()

        AndroidLogcatLogger.installOnDebuggableApp(this, minPriority = VERBOSE)

        initKoin(
            appModule = module {
                single<Context> { this@QyappApp }
                includes(shareModule(this@QyappApp))
            },
        )
    }

    override fun attachBaseContext(base: Context?) {
        super.attachBaseContext(base)
        SplitCompat.install(this)
    }
}
