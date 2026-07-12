# Android Packaging via GitHub Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the React/Vite app into an Android APK using Capacitor and a GitHub Actions pipeline.

**Architecture:** Capacitor is used to wrap the web assets into an Android project. GitHub Actions runs on every push to compile the debug APK using Gradle and JDK 17, and uploads the APK as an artifact.

**Tech Stack:** Node.js, Capacitor, GitHub Actions, Android SDK / Gradle.

## Global Constraints

- **Debug Build**: Only the `debug` APK will be built. This avoids keystore management and signing for now.
- **Dependencies**: This pipeline assumes the source code will be hosted on GitHub and that GitHub Actions are enabled.

---

### Task 1: Capacitor Initialization

**Files:**
- Create/Modify: `capacitor.config.ts`
- Create: `android/` directory

**Interfaces:**
- Consumes: Existing package.json dependencies and scripts.
- Produces: Initialized Capacitor Android project.

- [ ] **Step 1: Build Web Assets**
Run: `npm run build`
Expected: Command finishes successfully and the `dist` directory is generated.

- [ ] **Step 2: Initialize Capacitor Config**
Run: `npm run cap:init`
Expected: Generates `capacitor.config.ts` (if it doesn't already exist). Output should indicate successful initialization.

- [ ] **Step 3: Add Android Platform**
Run: `npm run cap:add`
Expected: The `android` directory is created.

- [ ] **Step 4: Commit Android Project**
Run:
```bash
git add capacitor.config.ts android/
git commit -m "build: initialize capacitor and android project"
```
Expected: Files are successfully committed.

---

### Task 2: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/android-build.yml`

**Interfaces:**
- Consumes: The `android` directory generated in Task 1.
- Produces: A GitHub Actions workflow that compiles the Android app into an APK.

- [ ] **Step 1: Create Workflow File**
Create `.github/workflows/android-build.yml` with the following content:
```yaml
name: Android Build

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Install dependencies
      run: npm install

    - name: Build web assets
      run: npm run build

    - name: Sync Capacitor
      run: npx cap sync android

    - name: Setup Java
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: '17'

    - name: Build Debug APK
      working-directory: ./android
      run: |
        chmod +x gradlew
        ./gradlew assembleDebug

    - name: Upload APK
      uses: actions/upload-artifact@v4
      with:
        name: app-debug
        path: android/app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 2: Commit Workflow File**
Run:
```bash
git add .github/workflows/android-build.yml
git commit -m "ci: add GitHub Actions workflow for Android APK build"
```
Expected: File is successfully committed.
