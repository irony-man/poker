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
include(":feature:progress")
