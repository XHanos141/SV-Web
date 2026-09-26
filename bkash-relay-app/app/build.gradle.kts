plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
}

android {
    namespace = "bd.suppverse.bkashrelay"
    compileSdk = 34

    defaultConfig {
        applicationId = "bd.suppverse.bkashrelay"
        minSdk = 26          // Android 8.0 — needed for JobScheduler-backed WorkManager reliability
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0-standalone"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")

    // Room — local queue, survives process death / offline periods
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // WorkManager — reliable retry/backoff upload, no foreground service needed
    implementation("androidx.work:work-runtime-ktx:2.9.1")

    // EncryptedSharedPreferences — relay URL + secret token stored safely on-device
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Networking
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
