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
    namespace = "com.felt.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.felt.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        buildConfigField(
            "String",
            "FELT_API_URL",
            "\"https://felt-server-hgi4.onrender.com\"",
        )
        buildConfigField(
            "String",
            "FELT_WS_URL",
            "\"wss://felt-server-hgi4.onrender.com/ws\"",
        )

        val localProps = Properties().apply {
            val f = rootProject.file("local.properties")
            if (f.exists()) f.inputStream().use(::load)
        }
        // Publishable key only (safe in the APK). Override via local.properties:
        // clerk.publishable.key=pk_test_...
        val clerkPk = localProps.getProperty(
            "clerk.publishable.key",
            "pk_test_bW92aW5nLWNvYnJhLTE5LmNsZXJrLmFjY291bnRzLmRldiQ",
        )
        buildConfigField("String", "CLERK_PUBLISHABLE_KEY", "\"$clerkPk\"")
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

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.hilt.android)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.clerk.android.ui)
    ksp(libs.hilt.compiler)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
}
