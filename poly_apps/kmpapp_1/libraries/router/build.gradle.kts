import extension.setFrameworkBaseName

plugins {
    id("com.escodro.multiplatform")
    alias(libs.plugins.compose)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    setFrameworkBaseName("router")

    sourceSets {
        commonMain.dependencies {
            implementation(libs.decompose)
            implementation(libs.decompose.compose)
            implementation(projects.features.navigationApi)
            implementation(libs.kotlinx.serialization)
        }
    }
}

android {
    namespace = "com.escodro.router"
}

