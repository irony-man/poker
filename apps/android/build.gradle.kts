plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.hilt) apply false
    alias(libs.plugins.ksp) apply false
}

// Hilt/Dagger still ship an older kotlin-metadata-jvm; Kotlin 2.4 emits metadata 2.4.0.
// Force the matching metadata reader until a Dagger release includes it.
subprojects {
    configurations.configureEach {
        resolutionStrategy {
            force(libs.kotlin.metadata.jvm)
        }
    }
}
