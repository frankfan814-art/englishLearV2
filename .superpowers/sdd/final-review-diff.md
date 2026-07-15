diff --git a/.superpowers/sdd/task-3-report.md b/.superpowers/sdd/task-3-report.md
new file mode 100644
index 0000000..7d7bd6b
--- /dev/null
+++ b/.superpowers/sdd/task-3-report.md
@@ -0,0 +1,41 @@
+# Task 3 Report: 创建词表配置和类型定义
+
+## Changes Made
+
+1. **Extended `Settings` interface** in `src/types/word.ts`
+   - Added `readDefinition?: boolean` field for toggling Chinese definition reading
+
+2. **Created `src/config/wordLists.ts`** with:
+   - `WordList` interface (id, name, tag, language, description?)
+   - `WORD_LISTS` array with 8 predefined lists: TOEFL, GRE, CET6, KY, IELTS, CET4, GK, Other
+   - `getWordListById()` helper function
+   - `getWordListIds()` helper function
+
+## Test Results
+
+- **TypeScript check (`tsc --noEmit`)**: Passed with no errors
+- **Full build (`npm run build`)**: Passed successfully (1983 modules, 4.50s)
+
+## Files Changed
+
+| File | Action |
+|------|--------|
+| `src/config/wordLists.ts` | Created (new file) |
+| `src/types/word.ts` | Modified (added `readDefinition` field) |
+
+## Self-Review Findings
+
+- Implementation matches the brief exactly
+- No TypeScript errors reported
+- No existing code is broken by these changes
+- The `other` word list uses empty string `tag: ''` as intended (catch-all for untagged words)
+
+## Issues or Concerns
+
+None. This is a straightforward configuration addition with no side effects.
+
+## Commit
+
+```
+e2f1491 feat(config): add word list configuration and types
+```
\ No newline at end of file
diff --git a/src/App.tsx b/src/App.tsx
index cc04f3b..912a9bb 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,6 +1,7 @@
 import { useState, useEffect, useCallback } from 'react';
 import { useAppStore } from './store/useAppStore';
 import { useAutoPlay, useTTS, unlockAudio } from './hooks/useTTS';
+import { useWakeLock } from './hooks/useWakeLock';
 import { WordCard } from './components/WordCard';
 import { ProgressBar } from './components/ProgressBar';
 import { SettingsModal } from './components/SettingsModal';
@@ -20,8 +21,7 @@ function App() {
     isPlaying,
     currentRound,
     currentIndex,
-    completedRounds,
-    totalWords,
+    listTotalWords,
     settings,
     isLearningMode,
     initialize,
@@ -39,6 +39,9 @@ function App() {
 
   useAutoPlay();
 
+  // Keep screen awake during playback
+  useWakeLock(isPlaying);
+
   const handleSpeak = () => {
     if (currentWord) {
       speak(currentWord.word, settings.accent, settings.speechRate || 1.0);
@@ -103,12 +106,7 @@ function App() {
 
       {/* Top Progress */}
       <div className="w-full safe-top">
-        <ProgressBar
-          current={currentIndex}
-          total={totalWords}
-          round={currentRound}
-          completedRounds={completedRounds}
-        />
+        <ProgressBar />
       </div>
 
       {/* Header */}
@@ -228,7 +226,7 @@ function App() {
         onUpdateSettings={updateSettings}
         onResetProgress={resetProgress}
         currentIndex={currentIndex}
-        totalWords={totalWords}
+        totalWords={listTotalWords}
         currentRound={currentRound}
       />
 
diff --git a/src/components/Home.tsx b/src/components/Home.tsx
index 856e1df..5053f06 100644
--- a/src/components/Home.tsx
+++ b/src/components/Home.tsx
@@ -1,76 +1,110 @@
+import { useState } from 'react';
 import { useAppStore } from '../store/useAppStore';
 import { Card } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { unlockAudio } from '../hooks/useTTS';
+import { WordListSelect } from './WordListSelect';
 
 export function Home() {
-  const { currentRound, currentIndex, totalWords, completedRounds, startLearning } = useAppStore();
+  const { currentRound, currentIndex, totalWords, completedRounds, startLearning, switchList } = useAppStore();
+  const [showListSelect, setShowListSelect] = useState(false);
 
   const percentage = ((currentIndex + 1) / totalWords) * 100;
 
-  return (
-    <div className="w-full h-full flex items-center justify-center p-4 animate-fade">
-      <Card className="glass card-hover w-full max-w-[400px] p-8 flex flex-col items-center justify-center rounded-2xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
-        
-        {/* App Icon / Logo */}
-        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-6 animate-glow">
-          <span className="text-primary-foreground text-4xl font-bold font-serif">E</span>
-        </div>
+  const handleQuickStart = async () => {
+    await switchList('all');
+    unlockAudio();
+    startLearning();
+  };
 
-        {/* Title */}
-        <h1 className="text-3xl font-bold text-gradient text-center mb-1">
-          单词朗读
-        </h1>
-        <p className="text-sm text-muted-foreground text-center mb-8">
-          听读记忆 · 高效刷词
-        </p>
+  const handleListSelect = () => {
+    setShowListSelect(true);
+  };
 
-        {/* Progress Stats */}
-        <div className="w-full bg-background/50 rounded-xl p-5 mb-6 border border-white/5">
-          <div className="flex justify-between items-center mb-3">
-            <span className="text-sm font-medium text-muted-foreground">当前轮次</span>
-            <span className="text-lg font-bold text-foreground">第 {currentRound} 轮</span>
-          </div>
-          
-          <div className="flex justify-between items-center mb-4">
-            <span className="text-sm font-medium text-muted-foreground">已完成轮次</span>
-            <span className="text-lg font-bold text-primary">{completedRounds} 轮</span>
+  return (
+    <>
+      <div className="w-full h-full flex items-center justify-center p-4 animate-fade">
+        <Card className="glass card-hover w-full max-w-[400px] p-8 flex flex-col items-center justify-center rounded-2xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
+
+          {/* App Icon / Logo */}
+          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-6 animate-glow">
+            <span className="text-primary-foreground text-4xl font-bold font-serif">E</span>
           </div>
 
-          <div className="w-full pt-4 border-t border-white/5">
-            <div className="flex justify-between items-end mb-2">
-              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">进度</span>
-              <div className="text-right">
-                <span className="font-bold text-foreground">{currentIndex + 1}</span>
-                <span className="text-muted-foreground mx-1">/</span>
-                <span className="text-sm text-muted-foreground">{totalWords}</span>
-              </div>
+          {/* Title */}
+          <h1 className="text-3xl font-bold text-gradient text-center mb-1">
+            单词朗读
+          </h1>
+          <p className="text-sm text-muted-foreground text-center mb-8">
+            听读记忆 · 高效刷词
+          </p>
+
+          {/* Quick Start Button */}
+          <Button
+            size="lg"
+            className="w-full h-14 rounded-xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform mb-3"
+            onClick={handleQuickStart}
+          >
+            快速开始
+            <span className="text-sm font-normal opacity-80 ml-2">
+              全部单词 · {totalWords.toLocaleString()} 词
+            </span>
+          </Button>
+
+          {/* Word List Select Button */}
+          <Button
+            size="lg"
+            variant="outline"
+            className="w-full h-14 rounded-xl text-base font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
+            onClick={handleListSelect}
+          >
+            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
+              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
+            </svg>
+            按词表学习
+            <span className="text-sm font-normal opacity-60 ml-2">
+              托福 / GRE / 四六级
+            </span>
+          </Button>
+
+          {/* Progress Stats */}
+          <div className="w-full bg-background/50 rounded-xl p-5 mt-6 border border-white/5">
+            <div className="flex justify-between items-center mb-3">
+              <span className="text-sm font-medium text-muted-foreground">当前轮次</span>
+              <span className="text-lg font-bold text-foreground">第 {currentRound} 轮</span>
+            </div>
+
+            <div className="flex justify-between items-center mb-4">
+              <span className="text-sm font-medium text-muted-foreground">已完成轮次</span>
+              <span className="text-lg font-bold text-primary">{completedRounds} 轮</span>
             </div>
-            {/* Progress Bar */}
-            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
-              <div 
-                className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 rounded-full progress-glow"
-                style={{ width: `${percentage}%` }}
-              />
+
+            <div className="w-full pt-4 border-t border-white/5">
+              <div className="flex justify-between items-end mb-2">
+                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">进度</span>
+                <div className="text-right">
+                  <span className="font-bold text-foreground">{currentIndex + 1}</span>
+                  <span className="text-muted-foreground mx-1">/</span>
+                  <span className="text-sm text-muted-foreground">{totalWords}</span>
+                </div>
+              </div>
+              {/* Progress Bar */}
+              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
+                <div
+                  className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 rounded-full progress-glow"
+                  style={{ width: `${percentage}%` }}
+                />
+              </div>
             </div>
           </div>
-        </div>
+        </Card>
+      </div>
 
-        {/* Start Button */}
-        <Button 
-          size="lg" 
-          className="w-full h-14 rounded-xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform"
-          onClick={() => {
-            unlockAudio();
-            startLearning();
-          }}
-        >
-          开始学习
-          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
-            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
-          </svg>
-        </Button>
-      </Card>
-    </div>
+      {/* Word List Select Modal */}
+      <WordListSelect
+        isOpen={showListSelect}
+        onClose={() => setShowListSelect(false)}
+      />
+    </>
   );
-}
+}
\ No newline at end of file
diff --git a/src/components/ProgressBar.tsx b/src/components/ProgressBar.tsx
index c7a8e0e..4701b1f 100644
--- a/src/components/ProgressBar.tsx
+++ b/src/components/ProgressBar.tsx
@@ -1,40 +1,49 @@
-interface Props {
-  current: number;
-  total: number;
-  round: number;
-  completedRounds: number;
-}
+import { useAppStore } from '../store/useAppStore';
+import { getWordListById } from '../config/wordLists';
 
-export function ProgressBar({ current, total, round, completedRounds }: Props) {
-  const percentage = ((current + 1) / total) * 100;
+export function ProgressBar() {
+  const { currentList, currentIndex, totalWords, listTotalWords, currentRound, completedRounds } = useAppStore();
 
-  return (
-    <div className="w-full animate-fade">
-      {/* Progress Bar */}
-      <div className="w-full h-1 bg-muted/50 overflow-hidden">
-        <div
-          className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 progress-glow"
-          style={{ width: `${percentage}%` }}
-        />
-      </div>
+  // Get list name
+  const wordList = currentList !== 'all' ? getWordListById(currentList) : null;
+  const listName = wordList?.name || '全部单词';
+
+  // Use listTotalWords for percentage when in a specific list
+  const effectiveTotal = currentList === 'all' ? totalWords : listTotalWords;
+  const percentage = effectiveTotal > 0 ? ((currentIndex + 1) / effectiveTotal) * 100 : 0;
 
-      {/* Progress Text */}
-      <div className="flex justify-between items-center px-6 mt-3">
-        <div className="flex items-center gap-2">
+  return (
+    <div className="w-full px-4 py-3 bg-background/80 backdrop-blur-sm border-b border-white/5">
+      <div className="max-w-[480px] mx-auto">
+        {/* List name and round */}
+        <div className="flex justify-between items-center mb-2">
           <span className="text-sm font-semibold text-foreground">
-            第{round}轮
+            {listName}
+          </span>
+          <span className="text-xs text-muted-foreground">
+            第 {currentRound} 轮
+          </span>
+        </div>
+
+        {/* Progress bar */}
+        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
+          <div
+            className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 rounded-full progress-glow"
+            style={{ width: `${percentage}%` }}
+          />
+        </div>
+
+        {/* Count */}
+        <div className="flex justify-between items-center mt-1">
+          <span className="text-xs text-muted-foreground">
+            {currentIndex + 1} / {effectiveTotal}
           </span>
           {completedRounds > 0 && (
-            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
+            <span className="text-xs text-primary">
               已完成 {completedRounds} 轮
             </span>
           )}
         </div>
-        <div className="text-right">
-          <span className="font-semibold text-foreground">{(current + 1)}</span>
-          <span className="text-muted-foreground mx-1">/</span>
-          <span className="text-sm text-muted-foreground">{total}</span>
-        </div>
       </div>
     </div>
   );
diff --git a/src/components/SettingsModal.tsx b/src/components/SettingsModal.tsx
index be3a867..7b83454 100644
--- a/src/components/SettingsModal.tsx
+++ b/src/components/SettingsModal.tsx
@@ -145,6 +145,32 @@ export function SettingsModal({
             </div>
           </div>
 
+          {/* 朗读中文释义 */}
+          <div>
+            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
+              朗读中文释义
+            </label>
+            <div className="grid grid-cols-2 gap-3">
+              <Button
+                variant={!settings.readDefinition ? 'default' : 'outline'}
+                onClick={() => onUpdateSettings({ readDefinition: false })}
+                className="font-medium"
+              >
+                关闭
+              </Button>
+              <Button
+                variant={settings.readDefinition ? 'default' : 'outline'}
+                onClick={() => onUpdateSettings({ readDefinition: true })}
+                className="font-medium"
+              >
+                开启
+              </Button>
+            </div>
+            <p className="text-xs text-muted-foreground mt-2">
+              开启后：单词 → 中文释义
+            </p>
+          </div>
+
           {/* 自动朗读例句 */}
           <div>
             <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
diff --git a/src/components/WordCard.tsx b/src/components/WordCard.tsx
index 63f01ad..016914b 100644
--- a/src/components/WordCard.tsx
+++ b/src/components/WordCard.tsx
@@ -131,7 +131,7 @@ export function WordCard({ word, isLoading, onSpeak, onSpeakExample, accent, onN
         {/* Core Content */}
         <CardContent className="flex-1 flex flex-col items-center justify-center w-full py-6 px-0">
           {/* Word */}
-          <h1 className="text-5xl sm:text-6xl font-bold text-gradient text-center mb-6 tracking-tight">
+          <h1 className="word-title text-gradient text-center mb-6 tracking-tight">
             {word.word}
           </h1>
 
diff --git a/src/components/WordListSelect.tsx b/src/components/WordListSelect.tsx
new file mode 100644
index 0000000..ddf558d
--- /dev/null
+++ b/src/components/WordListSelect.tsx
@@ -0,0 +1,127 @@
+import { useEffect, useState } from 'react';
+import { useAppStore } from '../store/useAppStore';
+import { WORD_LISTS, WordList } from '../config/wordLists';
+import { getWordCountByTag } from '../utils/wordListIndex';
+import { unlockAudio } from '../hooks/useTTS';
+import { Button } from '@/components/ui/button';
+import {
+  Drawer,
+  DrawerClose,
+  DrawerContent,
+  DrawerFooter,
+  DrawerHeader,
+  DrawerTitle,
+} from '@/components/ui/drawer';
+import { ProgressData } from '../types/word';
+
+interface WordListSelectProps {
+  isOpen: boolean;
+  onClose: () => void;
+}
+
+interface WordListWithStats extends WordList {
+  wordCount: number;
+  progress?: ProgressData;
+}
+
+export function WordListSelect({ isOpen, onClose }: WordListSelectProps) {
+  const { switchList, startLearning, listProgress } = useAppStore();
+  const [lists, setLists] = useState<WordListWithStats[]>([]);
+  const [loading, setLoading] = useState(true);
+
+  useEffect(() => {
+    if (isOpen) {
+      loadListStats();
+    }
+  }, [isOpen]);
+
+  const loadListStats = async () => {
+    setLoading(true);
+    const listsWithStats: WordListWithStats[] = [];
+
+    for (const list of WORD_LISTS) {
+      const wordCount = await getWordCountByTag(list.tag);
+      listsWithStats.push({
+        ...list,
+        wordCount,
+        progress: listProgress[list.id],
+      });
+    }
+
+    setLists(listsWithStats);
+    setLoading(false);
+  };
+
+  const handleSelectList = async (listId: string) => {
+    await switchList(listId);
+    unlockAudio();
+    startLearning();
+    onClose();
+  };
+
+  const formatProgress = (progress?: ProgressData, wordCount: number = 0) => {
+    if (!progress || progress.currentIndex === 0) {
+      return '未开始';
+    }
+    const percentage = wordCount > 0 ? ((progress.currentIndex + 1) / wordCount * 100).toFixed(0) : '0';
+    return `第 ${progress.currentRound} 轮 · ${percentage}%`;
+  };
+
+  return (
+    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
+      <DrawerContent>
+        <DrawerHeader>
+          <DrawerTitle>选择词表</DrawerTitle>
+        </DrawerHeader>
+
+        <div className="px-4 space-y-3 max-h-[60vh] overflow-y-auto">
+          {loading ? (
+            <div className="text-center py-8 text-muted-foreground">
+              加载中...
+            </div>
+          ) : (
+            lists.map((list) => {
+              const percentage = list.wordCount > 0
+                ? ((list.progress?.currentIndex || 0) + 1) / list.wordCount * 100
+                : 0;
+
+              return (
+                <button
+                  key={list.id}
+                  onClick={() => handleSelectList(list.id)}
+                  className="w-full text-left p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-white/5 active:scale-[0.98]"
+                >
+                  <div className="flex justify-between items-start mb-2">
+                    <div>
+                      <h3 className="font-semibold text-foreground">{list.name}</h3>
+                      <p className="text-sm text-muted-foreground mt-0.5">
+                        {list.wordCount.toLocaleString()} 词
+                      </p>
+                    </div>
+                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
+                      {formatProgress(list.progress, list.wordCount)}
+                    </span>
+                  </div>
+                  {list.progress && list.progress.currentIndex > 0 && (
+                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
+                      <div
+                        className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 rounded-full"
+                        style={{ width: `${percentage}%` }}
+                      />
+                    </div>
+                  )}
+                </button>
+              );
+            })
+          )}
+        </div>
+
+        <DrawerFooter>
+          <DrawerClose>
+            <Button variant="ghost" className="w-full">取消</Button>
+          </DrawerClose>
+        </DrawerFooter>
+      </DrawerContent>
+    </Drawer>
+  );
+}
\ No newline at end of file
diff --git a/src/config/wordLists.ts b/src/config/wordLists.ts
new file mode 100644
index 0000000..ec47ee2
--- /dev/null
+++ b/src/config/wordLists.ts
@@ -0,0 +1,41 @@
+/**
+ * Word list configuration
+ * Each list corresponds to a tag in the word data
+ */
+
+export interface WordList {
+  id: string;           // Unique identifier: 'toefl', 'gre', etc.
+  name: string;         // Display name: '托福词汇', 'GRE词汇', etc.
+  tag: string;          // Corresponding tag in word data
+  language: string;     // Language code: 'en', 'ja', 'ko', etc.
+  description?: string; // Optional description
+}
+
+/**
+ * Predefined word lists based on existing tag data
+ * Words can belong to multiple lists (tags can be combined)
+ */
+export const WORD_LISTS: WordList[] = [
+  { id: 'toefl', name: '托福词汇', tag: 'toefl', language: 'en' },
+  { id: 'gre', name: 'GRE词汇', tag: 'gre', language: 'en' },
+  { id: 'cet6', name: '六级词汇', tag: 'cet6', language: 'en' },
+  { id: 'ky', name: '考研词汇', tag: 'ky', language: 'en' },
+  { id: 'ielts', name: '雅思词汇', tag: 'ielts', language: 'en' },
+  { id: 'cet4', name: '四级词汇', tag: 'cet4', language: 'en' },
+  { id: 'gk', name: '高考词汇', tag: 'gk', language: 'en' },
+  { id: 'other', name: '其他词汇', tag: '', language: 'en' },
+];
+
+/**
+ * Get word list by ID
+ */
+export function getWordListById(id: string): WordList | undefined {
+  return WORD_LISTS.find(list => list.id === id);
+}
+
+/**
+ * Get all word list IDs
+ */
+export function getWordListIds(): string[] {
+  return WORD_LISTS.map(list => list.id);
+}
diff --git a/src/hooks/useTTS.ts b/src/hooks/useTTS.ts
index 2eb7f50..6fb4b78 100644
--- a/src/hooks/useTTS.ts
+++ b/src/hooks/useTTS.ts
@@ -141,7 +141,7 @@ export function useTTS() {
 }
 
 export function useAutoPlay() {
-  const { speak, stop, resetCancel } = useTTS();
+  const { speak, speakChinese, stop, resetCancel } = useTTS();
 
   const isPlaying = useAppStore(state => state.isPlaying);
   const isLoading = useAppStore(state => state.isLoading);
@@ -176,21 +176,37 @@ export function useAutoPlay() {
       }
 
       // 2. 稍微停顿
-      await new Promise(r => setTimeout(r, 500));
+      await new Promise(r => setTimeout(r, 300));
       if (!isActive) return;
 
       const currentSettings = useAppStore.getState().settings;
 
-      // 3. 如果开启了自动读例句，并且有例句，则读英文例句
+      // 3. 如果开启了读释义，读中文释义
+      if (currentSettings.readDefinition && currentWord.definition) {
+        const cleanDef = currentWord.definition.replace(/^[a-z]+\.\s*/i, '').trim();
+        if (cleanDef) {
+          const defSuccess = await speakChinese(cleanDef, settings.speechRate || 1.0);
+          if (!isActive) return;
+          if (!defSuccess) {
+            console.warn('[AutoPlay] Definition speech failed, but continuing');
+          }
+          await new Promise(r => setTimeout(r, 300));
+        }
+      }
+
+      if (!isActive) return;
+
+      // 4. 如果开启了自动读例句，并且有例句，则读英文例句
       if (currentSettings.readExample && currentWord.example) {
         const exampleSuccess = await speak(currentWord.example, currentSettings.accent, currentSettings.speechRate || 1.0);
         if (!isActive) return;
         if (!exampleSuccess) {
           console.warn('[AutoPlay] Example speech failed, but continuing to next word');
         }
+        await new Promise(r => setTimeout(r, 500));
       }
 
-      // 4. 等待用户设置的间隔后切换下一个
+      // 5. 等待用户设置的间隔后切换下一个
       timeoutId = setTimeout(() => {
         if (isActive) {
           const stillPlaying = useAppStore.getState().isPlaying;
diff --git a/src/hooks/useWakeLock.ts b/src/hooks/useWakeLock.ts
new file mode 100644
index 0000000..6f18a85
--- /dev/null
+++ b/src/hooks/useWakeLock.ts
@@ -0,0 +1,82 @@
+import { useEffect, useRef } from 'react';
+
+/**
+ * Keep screen awake while enabled (e.g., during audio playback)
+ * Uses Screen Wake Lock API with graceful fallback for unsupported browsers
+ */
+export function useWakeLock(enabled: boolean) {
+  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
+  const enabledRef = useRef(enabled);
+
+  // Keep enabledRef in sync
+  useEffect(() => {
+    enabledRef.current = enabled;
+  }, [enabled]);
+
+  useEffect(() => {
+    if (!enabled) {
+      // Release Wake Lock when disabled
+      if (wakeLockRef.current) {
+        wakeLockRef.current.release().catch(() => {});
+        wakeLockRef.current = null;
+      }
+      return;
+    }
+
+    // Check browser support
+    if (!('wakeLock' in navigator)) {
+      console.warn('[WakeLock] API not supported in this browser');
+      return;
+    }
+
+    // Request Wake Lock
+    const requestWakeLock = async () => {
+      try {
+        const wakeLock = await navigator.wakeLock.request('screen');
+        wakeLockRef.current = wakeLock;
+
+        // Listen for automatic release (tab switch, minimize, etc.)
+        wakeLock.addEventListener('release', () => {
+          wakeLockRef.current = null;
+          // Re-acquire if still enabled and page is visible
+          if (enabledRef.current && !document.hidden) {
+            requestWakeLock();
+          }
+        });
+      } catch (err) {
+        console.warn('[WakeLock] Request failed:', err);
+      }
+    };
+
+    requestWakeLock();
+
+    // Cleanup
+    return () => {
+      if (wakeLockRef.current) {
+        wakeLockRef.current.release().catch(() => {});
+        wakeLockRef.current = null;
+      }
+    };
+  }, [enabled]);
+
+  // Re-acquire wake lock when page becomes visible again
+  useEffect(() => {
+    const handleVisibilityChange = () => {
+      if (!document.hidden && enabledRef.current && !wakeLockRef.current) {
+        if ('wakeLock' in navigator) {
+          navigator.wakeLock.request('screen')
+            .then(wakeLock => {
+              wakeLockRef.current = wakeLock;
+              wakeLock.addEventListener('release', () => {
+                wakeLockRef.current = null;
+              });
+            })
+            .catch(() => {});
+        }
+      }
+    };
+
+    document.addEventListener('visibilitychange', handleVisibilityChange);
+    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
+  }, []);
+}
\ No newline at end of file
diff --git a/src/index.css b/src/index.css
index 9c91071..a8d5561 100644
--- a/src/index.css
+++ b/src/index.css
@@ -215,3 +215,13 @@ body {
 .card-hover {
   transition: transform 0.3s ease, box-shadow 0.3s ease;
 }
+
+/* Word title responsive sizing */
+.word-title {
+  font-size: clamp(1.75rem, 8vw, 3.75rem);
+  font-weight: 700;
+  word-break: break-word;
+  line-height: 1.4;
+  padding-bottom: 4px;
+  max-width: 100%;
+}
diff --git a/src/store/useAppStore.ts b/src/store/useAppStore.ts
index f6c7e46..16ecd91 100644
--- a/src/store/useAppStore.ts
+++ b/src/store/useAppStore.ts
@@ -1,6 +1,6 @@
 import { create } from 'zustand';
-import { Word, Settings } from '../types/word';
-import { storage } from '../utils/storage';
+import { Word, Settings, ProgressData } from '../types/word';
+import { storage, getCurrentList, getListProgress, saveCurrentList, saveListProgress, saveListProgressById } from '../utils/storage';
 import { dataLoader } from '../utils/dataLoader';
 
 interface AppState {
@@ -25,6 +25,13 @@ interface AppState {
   // Mastered
   masteredWords: Record<number, { word: string; definition: string }>;
 
+  // Word list navigation
+  language: string;
+  currentList: string;
+  listProgress: Record<string, ProgressData>;
+  wordIndexesInList: number[];
+  listTotalWords: number;
+
   // Actions
   initialize: () => Promise<void>;
   loadCurrentWord: () => Promise<void>;
@@ -37,6 +44,8 @@ interface AppState {
   resetProgress: () => void;
   markMastered: () => void;
   unmarkMastered: (index: number) => void;
+  switchList: (listId: string) => Promise<void>;
+  loadListWord: () => Promise<void>;
 }
 
 export const useAppStore = create<AppState>((set, get) => ({
@@ -53,32 +62,79 @@ export const useAppStore = create<AppState>((set, get) => ({
   settings: storage.getSettings(),
   masteredWords: storage.getMasteredWords(),
 
+  // Word list navigation initial state
+  language: 'en',
+  currentList: getCurrentList(),
+  listProgress: getListProgress(),
+  wordIndexesInList: [],
+  listTotalWords: 16194,
+
   // Initialize from storage
   initialize: async () => {
     const progress = storage.getProgress();
+    const currentList = getCurrentList();
+    const listProgress = getListProgress();
+
     set({
       currentRound: progress.currentRound,
       currentIndex: progress.currentIndex,
       completedRounds: progress.completedRounds,
       settings: storage.getSettings(),
       masteredWords: storage.getMasteredWords(),
+      currentList,
+      listProgress,
       isLoading: true,
     });
 
-    await get().loadCurrentWord();
+    // Build word list index
+    await import('../utils/wordListIndex').then(({ buildWordListIndex }) => buildWordListIndex());
+
+    // Load word indexes for current list
+    if (currentList === 'all') {
+      set({
+        wordIndexesInList: Array.from({ length: 16194 }, (_, i) => i),
+        listTotalWords: 16194,
+      });
+    } else {
+      const { getWordIndexesByTag } = await import('../utils/wordListIndex');
+      const { getWordListById } = await import('../config/wordLists');
+      const wordList = getWordListById(currentList);
+
+      if (wordList) {
+        const indexes = await getWordIndexesByTag(wordList.tag);
+        set({
+          wordIndexesInList: indexes,
+          listTotalWords: indexes.length,
+        });
+      }
+    }
+
+    await get().loadListWord();
   },
 
-  // Load current word
+  // Load current word (delegates to loadListWord)
   loadCurrentWord: async () => {
-    const { currentIndex } = get();
+    await get().loadListWord();
+  },
+
+  // Load word at current index in current list
+  loadListWord: async () => {
+    const { currentIndex, wordIndexesInList } = get();
+
+    if (wordIndexesInList.length === 0) {
+      set({ currentWord: null, isLoading: false });
+      return;
+    }
+
     set({ isLoading: true, error: null });
 
     try {
-      const word = await dataLoader.getWord(currentIndex);
+      const globalIndex = wordIndexesInList[currentIndex];
+      const word = await dataLoader.getWord(globalIndex);
+
       if (word) {
         set({ currentWord: word, isLoading: false });
-        // Preload adjacent shards
-        dataLoader.preloadAdjacent(currentIndex);
+        dataLoader.preloadAdjacent(globalIndex);
       } else {
         set({ error: 'Word not found', isLoading: false });
       }
@@ -87,24 +143,30 @@ export const useAppStore = create<AppState>((set, get) => ({
     }
   },
 
-  // Next word
+  // Next word (within current list)
   nextWord: () => {
-    const { currentIndex, currentRound, totalWords, masteredWords } = get();
+    const { currentIndex, wordIndexesInList, listTotalWords, masteredWords, currentList } = get();
+
+    if (wordIndexesInList.length === 0) return;
+
     let newIndex = currentIndex;
-    let newRound = currentRound;
-    let newCompletedRounds = get().completedRounds;
-    
-    // Prevent infinite loop if all words are mastered
     let attempts = 0;
+
     do {
-      newIndex += 1;
-      if (newIndex >= totalWords) {
-        newIndex = 0;
-        newCompletedRounds += 1;
-        newRound += 1;
-      }
+      newIndex = (newIndex + 1) % listTotalWords;
       attempts++;
-    } while (masteredWords[newIndex] !== undefined && attempts < totalWords);
+    } while (
+      masteredWords[wordIndexesInList[newIndex]] !== undefined
+      && attempts < listTotalWords
+    );
+
+    const newCompletedRounds = attempts >= listTotalWords
+      ? get().completedRounds + 1
+      : get().completedRounds;
+
+    const newRound = attempts >= listTotalWords
+      ? get().currentRound + 1
+      : get().currentRound;
 
     set({
       currentIndex: newIndex,
@@ -113,48 +175,58 @@ export const useAppStore = create<AppState>((set, get) => ({
     });
 
     // Save progress
-    storage.saveProgress({
+    const progress: ProgressData = {
       currentRound: newRound,
       currentIndex: newIndex,
       completedRounds: newCompletedRounds,
       lastUpdate: new Date().toISOString(),
-    });
+    };
 
-    get().loadCurrentWord();
+    if (currentList === 'all') {
+      storage.saveProgress(progress);
+    } else {
+      saveListProgressById(currentList, progress);
+    }
+
+    get().loadListWord();
   },
 
-  // Previous word
+  // Previous word (within current list)
   prevWord: () => {
-    const { currentIndex, currentRound, totalWords, completedRounds, masteredWords } = get();
-    let newIndex = currentIndex;
-    let newRound = currentRound;
-    let newCompletedRounds = completedRounds;
+    const { currentIndex, wordIndexesInList, listTotalWords, masteredWords, currentList } = get();
+
+    if (wordIndexesInList.length === 0) return;
 
+    let newIndex = currentIndex;
     let attempts = 0;
+
     do {
-      newIndex -= 1;
-      if (newIndex < 0) {
-        newIndex = totalWords - 1;
-        newRound = Math.max(1, currentRound - 1);
-        newCompletedRounds = Math.max(0, completedRounds - 1);
-      }
+      newIndex = newIndex === 0 ? listTotalWords - 1 : newIndex - 1;
       attempts++;
-    } while (masteredWords[newIndex] !== undefined && attempts < totalWords);
+    } while (
+      masteredWords[wordIndexesInList[newIndex]] !== undefined
+      && attempts < listTotalWords
+    );
 
     set({
       currentIndex: newIndex,
-      currentRound: newRound,
-      completedRounds: newCompletedRounds,
     });
 
-    storage.saveProgress({
-      currentRound: newRound,
+    // Save progress
+    const progress: ProgressData = {
+      currentRound: get().currentRound,
       currentIndex: newIndex,
-      completedRounds: newCompletedRounds,
+      completedRounds: get().completedRounds,
       lastUpdate: new Date().toISOString(),
-    });
+    };
 
-    get().loadCurrentWord();
+    if (currentList === 'all') {
+      storage.saveProgress(progress);
+    } else {
+      saveListProgressById(currentList, progress);
+    }
+
+    get().loadListWord();
   },
 
   // Toggle play/pause
@@ -196,15 +268,16 @@ export const useAppStore = create<AppState>((set, get) => ({
 
   // Mark current word as mastered
   markMastered: () => {
-    const { currentWord, currentIndex, masteredWords } = get();
-    if (!currentWord) return;
+    const { currentWord, currentIndex, wordIndexesInList, masteredWords } = get();
+    if (!currentWord || wordIndexesInList.length === 0) return;
 
+    const globalIndex = wordIndexesInList[currentIndex];
     const cleanDef = currentWord.definition.replace(/^[a-z]+\.\s*/i, '').trim();
-    const newMastered = { ...masteredWords, [currentIndex]: { word: currentWord.word, definition: cleanDef } };
-    
+    const newMastered = { ...masteredWords, [globalIndex]: { word: currentWord.word, definition: cleanDef } };
+
     set({ masteredWords: newMastered });
     storage.saveMasteredWords(newMastered);
-    
+
     // Automatically jump to next word after mastering
     get().nextWord();
   },
@@ -214,8 +287,74 @@ export const useAppStore = create<AppState>((set, get) => ({
     const { masteredWords } = get();
     const newMastered = { ...masteredWords };
     delete newMastered[index];
-    
+
     set({ masteredWords: newMastered });
     storage.saveMasteredWords(newMastered);
   },
+
+  // Switch to a different word list
+  switchList: async (listId: string) => {
+    const { listProgress, currentList, currentRound, currentIndex, completedRounds } = get();
+
+    // Save current list progress
+    const currentProgress: ProgressData = {
+      currentRound,
+      currentIndex,
+      completedRounds,
+      lastUpdate: new Date().toISOString(),
+    };
+
+    const updatedListProgress = {
+      ...listProgress,
+      [currentList]: currentProgress,
+    };
+
+    // Get word indexes for target list
+    let newWordIndexesInList: number[];
+    let newListTotalWords: number;
+
+    if (listId === 'all') {
+      newWordIndexesInList = Array.from({ length: 16194 }, (_, i) => i);
+      newListTotalWords = 16194;
+    } else {
+      const { getWordIndexesByTag } = await import('../utils/wordListIndex');
+      const { getWordListById } = await import('../config/wordLists');
+      const wordList = getWordListById(listId);
+
+      if (!wordList) {
+        console.error(`Word list not found: ${listId}`);
+        return;
+      }
+
+      newWordIndexesInList = await getWordIndexesByTag(wordList.tag);
+      newListTotalWords = newWordIndexesInList.length;
+    }
+
+    // Load target list progress (or initialize)
+    const targetProgress = updatedListProgress[listId] || {
+      currentRound: 1,
+      currentIndex: 0,
+      completedRounds: 0,
+      lastUpdate: new Date().toISOString(),
+    };
+
+    // Update state
+    set({
+      currentList: listId,
+      wordIndexesInList: newWordIndexesInList,
+      listTotalWords: newListTotalWords,
+      currentRound: targetProgress.currentRound,
+      currentIndex: targetProgress.currentIndex,
+      completedRounds: targetProgress.completedRounds,
+      listProgress: updatedListProgress,
+      isLoading: true,
+    });
+
+    // Save to storage
+    saveCurrentList(listId);
+    saveListProgress(updatedListProgress);
+
+    // Load current word
+    await get().loadListWord();
+  },
 }));
\ No newline at end of file
diff --git a/src/types/word.ts b/src/types/word.ts
index 55b9a51..859dfdb 100644
--- a/src/types/word.ts
+++ b/src/types/word.ts
@@ -26,6 +26,7 @@ export interface Settings {
   speed: number;
   speechRate?: number;
   readExample?: boolean;
+  readDefinition?: boolean;   // 新增：读中文释义
   accent: 'us' | 'uk';
   autoPlay: boolean;
 }
\ No newline at end of file
diff --git a/src/utils/storage.ts b/src/utils/storage.ts
index b38dd3e..66a7e37 100644
--- a/src/utils/storage.ts
+++ b/src/utils/storage.ts
@@ -81,4 +81,65 @@ export const storage = {
       console.error('Failed to save mastered words:', e);
     }
   },
-};
\ No newline at end of file
+};
+
+// === Word List Progress Storage ===
+
+const KEY_CURRENT_LIST = 'vocab_current_list';
+const KEY_LIST_PROGRESS = 'vocab_list_progress';
+
+/**
+ * Get current word list ID
+ * Returns 'all' if not set (backward compatible)
+ */
+export function getCurrentList(): string {
+  const stored = localStorage.getItem(KEY_CURRENT_LIST);
+  return stored || 'all';
+}
+
+/**
+ * Save current word list ID
+ */
+export function saveCurrentList(listId: string): void {
+  localStorage.setItem(KEY_CURRENT_LIST, listId);
+}
+
+/**
+ * Get progress for all word lists
+ */
+export function getListProgress(): Record<string, ProgressData> {
+  const stored = localStorage.getItem(KEY_LIST_PROGRESS);
+  if (!stored) {
+    return {};
+  }
+  try {
+    return JSON.parse(stored);
+  } catch {
+    return {};
+  }
+}
+
+/**
+ * Save progress for a specific word list
+ */
+export function saveListProgress(progress: Record<string, ProgressData>): void {
+  localStorage.setItem(KEY_LIST_PROGRESS, JSON.stringify(progress));
+}
+
+/**
+ * Get progress for a specific word list
+ * Returns undefined if not found
+ */
+export function getListProgressById(listId: string): ProgressData | undefined {
+  const allProgress = getListProgress();
+  return allProgress[listId];
+}
+
+/**
+ * Save progress for a specific word list
+ */
+export function saveListProgressById(listId: string, progress: ProgressData): void {
+  const allProgress = getListProgress();
+  allProgress[listId] = progress;
+  saveListProgress(allProgress);
+}
\ No newline at end of file
diff --git a/src/utils/wordListIndex.ts b/src/utils/wordListIndex.ts
new file mode 100644
index 0000000..a9ed63e
--- /dev/null
+++ b/src/utils/wordListIndex.ts
@@ -0,0 +1,99 @@
+import { dataLoader } from './dataLoader';
+
+/**
+ * Word list index for fast lookup
+ * Maps tag -> Set of global word indexes
+ */
+let wordListIndexCache: Map<string, Set<number>> | null = null;
+let indexBuildPromise: Promise<Map<string, Set<number>>> | null = null;
+
+/**
+ * Build word list index by scanning all words
+ * Caches the result for subsequent calls
+ */
+export async function buildWordListIndex(): Promise<Map<string, Set<number>>> {
+  // Return cached index if available
+  if (wordListIndexCache) {
+    return wordListIndexCache;
+  }
+
+  // Return existing build promise if already building
+  if (indexBuildPromise) {
+    return indexBuildPromise;
+  }
+
+  // Build index
+  indexBuildPromise = (async () => {
+    const index = new Map<string, Set<number>>();
+
+    // Total words: 16194 (17 shards * ~1000)
+    const totalWords = 16194;
+
+    // Load all shards and build index
+    for (let globalIndex = 0; globalIndex < totalWords; globalIndex++) {
+      try {
+        const word = await dataLoader.getWord(globalIndex);
+        if (word) {
+          const tag = word.tag || '';
+
+          // Handle empty tag (other vocabulary)
+          if (tag === '') {
+            if (!index.has('')) {
+              index.set('', new Set());
+            }
+            index.get('')!.add(globalIndex);
+          } else {
+            // Split combined tags (e.g., "cet4 cet6 toefl")
+            const tags = tag.split(/\s+/).filter(t => t);
+            for (const t of tags) {
+              if (!index.has(t)) {
+                index.set(t, new Set());
+              }
+              index.get(t)!.add(globalIndex);
+            }
+          }
+        }
+      } catch (err) {
+        console.error(`Failed to load word at index ${globalIndex}:`, err);
+      }
+    }
+
+    wordListIndexCache = index;
+    indexBuildPromise = null;
+    return index;
+  })();
+
+  return indexBuildPromise;
+}
+
+/**
+ * Get word indexes by tag
+ * Returns empty array if tag not found
+ */
+export async function getWordIndexesByTag(tag: string): Promise<number[]> {
+  const index = await buildWordListIndex();
+  const indexes = index.get(tag);
+
+  if (!indexes) {
+    return [];
+  }
+
+  return Array.from(indexes).sort((a, b) => a - b);
+}
+
+/**
+ * Get word count by tag
+ */
+export async function getWordCountByTag(tag: string): Promise<number> {
+  const index = await buildWordListIndex();
+  const indexes = index.get(tag);
+  return indexes ? indexes.size : 0;
+}
+
+/**
+ * Clear index cache (for testing)
+ */
+export function clearWordListIndexCache(): void {
+  wordListIndexCache = null;
+  indexBuildPromise = null;
+}
