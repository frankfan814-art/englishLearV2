# Task 3 Brief: 创建词表配置和类型定义

## Files
- Create: `src/config/wordLists.ts`
- Modify: `src/types/word.ts`

## Interfaces
- Consumes: 无
- Produces: `WordList` 接口, `WORD_LISTS` 数组, `Settings.readDefinition`

## Requirements

### Step 1: 扩展 Settings 类型

修改 `src/types/word.ts`，在 `Settings` 接口中添加新字段：

```typescript
export interface Settings {
  speed: number;
  speechRate?: number;
  readExample?: boolean;
  readDefinition?: boolean;   // 新增：读中文释义
  accent: 'us' | 'uk';
  autoPlay: boolean;
}
```

### Step 2: 创建词表配置文件

创建 `src/config/wordLists.ts`：

```typescript
/**
 * Word list configuration
 * Each list corresponds to a tag in the word data
 */

export interface WordList {
  id: string;           // Unique identifier: 'toefl', 'gre', etc.
  name: string;         // Display name: '托福词汇', 'GRE词汇', etc.
  tag: string;          // Corresponding tag in word data
  language: string;     // Language code: 'en', 'ja', 'ko', etc.
  description?: string; // Optional description
}

/**
 * Predefined word lists based on existing tag data
 * Words can belong to multiple lists (tags can be combined)
 */
export const WORD_LISTS: WordList[] = [
  { id: 'toefl', name: '托福词汇', tag: 'toefl', language: 'en' },
  { id: 'gre', name: 'GRE词汇', tag: 'gre', language: 'en' },
  { id: 'cet6', name: '六级词汇', tag: 'cet6', language: 'en' },
  { id: 'ky', name: '考研词汇', tag: 'ky', language: 'en' },
  { id: 'ielts', name: '雅思词汇', tag: 'ielts', language: 'en' },
  { id: 'cet4', name: '四级词汇', tag: 'cet4', language: 'en' },
  { id: 'gk', name: '高考词汇', tag: 'gk', language: 'en' },
  { id: 'other', name: '其他词汇', tag: '', language: 'en' },
];

/**
 * Get word list by ID
 */
export function getWordListById(id: string): WordList | undefined {
  return WORD_LISTS.find(list => list.id === id);
}

/**
 * Get all word list IDs
 */
export function getWordListIds(): string[] {
  return WORD_LISTS.map(list => list.id);
}
```

### Step 3: 提交

```bash
git add src/config/wordLists.ts src/types/word.ts
git commit -m "feat(config): add word list configuration and types

- Add WordList interface with id, name, tag, language
- Define 8 word lists: TOEFL, GRE, CET6, KY, IELTS, CET4, GK, Other
- Add readDefinition to Settings for reading Chinese definition

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

## Report Contract

After completing the task, write a report to `E:/work/englishLearn/.superpowers/sdd/task-3-report.md` with:
1. Changes made
2. Test results (TypeScript check, build)
3. Any concerns or issues encountered
4. Commit hash

Then report status: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED