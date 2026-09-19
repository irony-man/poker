pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.10.0"
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "pokr-android"

include(":app")
include(":core:common")
include(":core:model")
include(":core:network")
include(":core:datastore")
include(":core:designsystem")
include(":core:engine")
include(":feature:lobby")
include(":feature:table")
include(":feature:offline")
include(":feature:ludo")
include(":feature:snakes")
include(":feature:memory")
include(":feature:courtpiece")
include(":feature:admin")
include(":feature:progress")
