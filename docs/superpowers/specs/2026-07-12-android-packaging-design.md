# Android Packaging via GitHub Actions Design

## Overview
This document specifies the process and architecture for packaging the React/Vite application into an Android APK using Capacitor and GitHub Actions. This approach avoids requiring a local Android development environment.

## 1. Local Initialization (Capacitor)
- **Goal**: Scaffold the `android` directory so it can be committed to the repository.
- **Steps**:
  - Run `npx cap init` to generate `capacitor.config.ts` (if not already present).
  - Build the web assets (`npm run build`).
  - Run `npx cap add android` to create the Android project structure.
  - **Note**: The `android/` directory must be committed to Git. Build directories like `android/app/build` will be correctly ignored by Capacitor's default `.gitignore`.

## 2. Cloud CI/CD Pipeline (GitHub Actions)
- **Goal**: Automatically build the Android APK whenever code is pushed.
- **File**: `.github/workflows/android-build.yml`
- **Workflow Steps**:
  1. **Checkout**: Use `actions/checkout@v4`.
  2. **Setup Node.js**: Use `actions/setup-node@v4` with Node.js 20.
  3. **Install Dependencies**: `npm install`.
  4. **Build Web App**: `npm run build`.
  5. **Sync Capacitor**: `npx cap sync android`.
  6. **Setup Java JDK**: Use `actions/setup-java@v4` with JDK 17 (required for newer Android Gradle plugins).
  7. **Build APK**:
     - Navigate to the `android` folder.
     - Make the gradle wrapper executable: `chmod +x gradlew`
     - Run `./gradlew assembleDebug` to build the debug version.
  8. **Upload Artifact**: Use `actions/upload-artifact@v4` to upload the generated APK (`android/app/build/outputs/apk/debug/app-debug.apk`) so it can be downloaded from the GitHub Actions run page.

## 3. Scope & Constraints
- **Debug Build**: Only the `debug` APK will be built. This is sufficient for installing and testing on your phone. It avoids the complexities of keystore management, passwords, and code signing required for a `release` build.
- **Dependencies**: This pipeline assumes the source code will be hosted on GitHub and that GitHub Actions are enabled.
