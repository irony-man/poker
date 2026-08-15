import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.pokr.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.pokr.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        val localProps = Properties().apply {
            val f = rootProject.file("local.properties")
            if (f.exists()) f.inputStream().use(::load)
        }
        // Override in local.properties for a local anonymous server, e.g.:
        // pokr.api.url=http://10.0.2.2:4000
        // pokr.ws.url=ws://10.0.2.2:4000/ws
        val pokrApiUrl = localProps.getProperty(
            "pokr.api.url",
            "https://felt-server-hgi4.onrender.com",
        )
        val pokrWsUrl = localProps.getProperty(
            "pokr.ws.url",
            "wss://felt-server-hgi4.onrender.com/ws",
        )
        buildConfigField("String", "POKR_API_URL", "\"$pokrApiUrl\"")
        buildConfigField("String", "POKR_WS_URL", "\"$pokrWsUrl\"")

        val pokrWebUrl = localProps.getProperty("pokr.web.url", "http://localhost:3000")
        buildConfigField("String", "POKR_WEB_URL", "\"$pokrWebUrl\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }


    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            // okhttp logging-interceptor and jspecify both ship this multi-release entry
            pickFirsts += "META-INF/versions/9/OSGI-INF/MANIFEST.MF"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(project(":core:common"))
    implementation(project(":core:model"))
    implementation(project(":core:network"))
    implementation(project(":core:datastore"))
    implementation(project(":core:designsystem"))
    implementation(project(":core:engine"))
    implementation(project(":feature:lobby"))
    implementation(project(":feature:table"))
    implementation(project(":feature:offline"))
    implementation(project(":feature:progress"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.hilt.android)
    implementation(libs.hilt.navigation.compose)
    ksp(libs.hilt.compiler)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
}
