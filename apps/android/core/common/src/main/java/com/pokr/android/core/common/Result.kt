package com.pokr.android.core.common

sealed class Result<out T> {
    data class Success<T>(val value: T) : Result<T>()
    data class Error(val throwable: Throwable) : Result<Nothing>()
}

inline fun <T> Result<T>.getOrNull(): T? = when (this) {
    is Result.Success -> value
    is Result.Error -> null
}
