import extension.setFrameworkBaseName

plugins {
    id("com.escodro.multiplatform")
}

kotlin {
    setFrameworkBaseName("shareApi")

    sourceSets {
        commonMain.dependencies {
            implementation(projects.libraries.coroutines)
            implementation(libs.koin.core)
        }

        androidMain.dependencies {
            implementation(libs.androidx.corektx)
        }
    }
}

android {
    namespace = "com.escodro.shareapi"
}

