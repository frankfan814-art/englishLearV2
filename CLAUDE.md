# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"单词朗读" (Vocab Master) is a minimal English vocabulary learning app focused on automatic word pronunciation and spaced repetition. It's a React-based PWA that can be packaged as an Android APK via Capacitor.

**Core Features:**
- Automatic TTS pronunciation with configurable speed/accent (US/UK)
- 16,194 words loaded in 17 sharded JSON files (1000 words each)
- Progress tracking with rounds and persistence via localStorage
- "Mastered" words system - marked words are skipped in future rounds
- Mobile-first design with swipe gestures and glassmorphism UI

## Commands

```bash
# Development
npm run dev          # Start dev server on port 3000

# Build
npm run build        # TypeScript check + Vite build → dist/

# Lint
npm run lint         # ESLint

# Capacitor (Android)
npm run cap:sync     # Sync dist/ to android/
npx cap open android # Open Android Studio for APK build
```

## Architecture

### State Management (Zustand)

`src/store/useAppStore.ts` is the single source of truth:
- Word data, progress, settings, and playback state
- Persists to localStorage via `src/utils/storage.ts`
- Handles "mastered words" logic (skips them during navigation)

### Data Loading

`src/utils/dataLoader.ts` implements lazy loading:
- Words stored in `public/data/words-001.json` to `words-017.json`
- Each shard: 1000 words
- Cache + preload adjacent shards for smooth navigation

### TTS System

`src/hooks/useTTS.ts`:
1. **Primary**: Youdao Dictionary API for real human audio (`https://dict.youdao.com/dictvoice?audio={word}&type={1|2}`)
2. **Fallback**: Web Speech API (`speechSynthesis`)
- Single `Audio` instance for mobile autoplay unlock
- `unlockAudio()` must be called on user interaction before playback

### Key Components

| Component | Purpose |
|-----------|---------|
| `App.tsx` | Main layout, keyboard shortcuts, visibility change handling |
| `Home.tsx` | Landing page with progress stats |
| `WordCard.tsx` | Word display + swipe gestures for prev/next |
| `SettingsModal.tsx` | Speed, speech rate, accent, read example toggles |
| `MasteredList.tsx` | View/restore mastered words |
| `ProgressBar.tsx` | Round progress indicator |

### Types

`src/types/word.ts`:
- `Word`: id, word, phonetic, pos, definition, example?, tag?
- `Settings`: speed (interval), speechRate, accent, autoPlay, readExample
- `ProgressData`: currentRound, currentIndex, completedRounds

## UI/Styling

- Tailwind CSS with CSS variables for theming (dark mode only)
- Custom CSS in `src/index.css`: glassmorphism, gradients, animations
- shadcn/ui components in `src/components/ui/`
- Path alias: `@/` → `src/`

## Android Build

- GitHub Actions (`.github/workflows/build-apk.yml`) auto-builds APK on push to main
- APK published to GitHub Releases with tag "latest"
- Capacitor config: `capacitor.config.ts` (appId: `com.vocab.app`)

## Data Source

- Word database curated from ECDICT (see `TECHNICAL_DESIGN.md` for details)
- Filtered for ~16K useful vocabulary (excludes very simple words)
