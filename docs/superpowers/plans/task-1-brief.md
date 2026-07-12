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
