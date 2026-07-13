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
