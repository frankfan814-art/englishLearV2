/**
 * E2E 自动化测试：模拟真实用户操作测试全部功能
 * 运行方式：npx playwright test
 * 覆盖：首页渲染/居中、语言切换、学习流程、TTS发音链路、设置面板、词表选择、已掌握、进度保留
 */
import { test, expect, Page } from '@playwright/test';

/** 已知的无害控制台噪音（Chrome 音频中断提示），不计入问题报告 */
const NOISE_PATTERNS = [
  'The play() request was interrupted',
  'AbortError',
];

test.beforeEach(async ({ page }, testInfo) => {
  // 实时输出控制台错误（过滤已知噪音）
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text().split('\n')[0];
      if (!NOISE_PATTERNS.some((p) => text.includes(p))) {
        console.log(`  [console.error][${testInfo.title}] ${text}`);
      }
    }
  });
  // 在页面脚本执行前清空 localStorage，保证每个测试从全新状态开始（避免 reload 中断请求）
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await expect(page.getByText('单词朗读').first()).toBeVisible();
});

// ============ 辅助函数 ============

/** 进入学习模式并等待单词卡片加载 */
async function enterLearning(page: Page) {
  await page.getByRole('button', { name: /开始学习|继续学习/ }).click();
  await expect(page.locator('.word-title')).toBeVisible();
}

/** 获取当前显示的单词文本 */
async function getCurrentWord(page: Page): Promise<string> {
  return ((await page.locator('.word-title').textContent()) || '').trim();
}

/** 关闭当前打开的抽屉（点击可见的 drawer-close 按钮） */
async function closeDrawer(page: Page) {
  await page.locator('[data-slot="drawer-close"]:visible').click();
  await page.waitForTimeout(400);
}

// ============ 1. 首页渲染 ============

test.describe('首页', () => {
  test('首页元素完整渲染', async ({ page }) => {
    // 标题与副标题
    await expect(page.getByRole('heading', { name: '单词朗读' })).toBeVisible();
    await expect(page.getByText('听读记忆 · 高效刷词')).toBeVisible();

    // 语言 Tab（4 种语言）
    for (const lang of ['英语', '日语', '韩语', '德语']) {
      await expect(page.getByRole('button', { name: lang })).toBeVisible();
    }

    // 开始学习按钮 + 词表按钮
    await expect(page.getByRole('button', { name: /开始学习|继续学习/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /按词表学习/ })).toBeVisible();

    // 进度统计区域
    await expect(page.getByText('当前轮次')).toBeVisible();
    await expect(page.getByText('已掌握')).toBeVisible();

    // 试用版提示（未激活时显示）
    await expect(page.getByText(/试用版/)).toBeVisible();

    // 底部卖点条
    await expect(page.getByText(/离线畅学/)).toBeVisible();
  });

  test('首页卡片垂直居中', async ({ page }) => {
    const card = page.locator('.glass').first();
    await expect(card).toBeVisible();

    const cardBox = await card.boundingBox();
    const viewport = page.viewportSize();
    expect(cardBox).not.toBeNull();
    expect(viewport).not.toBeNull();

    // 卡片中心应接近视口中心（允许 15% 偏差）
    const cardCenterY = cardBox!.y + cardBox!.height / 2;
    const viewportCenterY = viewport!.height / 2;
    expect(Math.abs(cardCenterY - viewportCenterY)).toBeLessThan(viewport!.height * 0.15);

    // 水平居中
    const cardCenterX = cardBox!.x + cardBox!.width / 2;
    const viewportCenterX = viewport!.width / 2;
    expect(Math.abs(cardCenterX - viewportCenterX)).toBeLessThan(10);
  });

  test('首页可滚动（小屏幕内容溢出不裁切）', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 500 });
    const container = page.locator('.h-dvh');
    await expect(container).toBeVisible();

    // 容器应该可滚动
    const scrollable = await container.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(scrollable).toBe(true);

    // 滚动到底部，卖点条仍可见（内容未被裁切）
    await container.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(page.getByText(/离线畅学/)).toBeVisible();
  });
});

// ============ 2. 语言切换 ============

test.describe('语言切换', () => {
  test('切换到日语', async ({ page }) => {
    await page.getByRole('button', { name: '日语' }).click();
    // Logo 变为 "日"
    await expect(page.locator('span:text-is("日")')).toBeVisible();
    // 持久化验证
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('vocab_current_language')))
      .toBe('ja');
    // 开始按钮仍可用（试用模式显示截断词数 200）
    await expect(page.getByRole('button', { name: /开始学习|继续学习/ })).toContainText('全部单词');
  });

  test('切换到德语', async ({ page }) => {
    await page.getByRole('button', { name: '德语' }).click();
    await expect(page.locator('span:text-is("D")')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('vocab_current_language')))
      .toBe('de');
  });

  test('切换到韩语再切回英语', async ({ page }) => {
    await page.getByRole('button', { name: '韩语' }).click();
    await expect(page.locator('span:text-is("한")')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('vocab_current_language')))
      .toBe('ko');

    await page.getByRole('button', { name: '英语' }).click();
    await expect(page.locator('span:text-is("E")')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('vocab_current_language')))
      .toBe('en');
  });

  test('切换语言后进入学习显示对应文字', async ({ page }) => {
    // 切换到韩语 → 开始学习 → 单词应包含韩文字符
    await page.getByRole('button', { name: '韩语' }).click();
    await expect(page.locator('span:text-is("한")')).toBeVisible();
    await enterLearning(page);
    const word = await getCurrentWord(page);
    expect(word.length).toBeGreaterThan(0);
    // 韩语单词应包含韩文音节（가-힣）
    expect(/[\uAC00-\uD7A3]/.test(word)).toBe(true);
  });
});

// ============ 3. 学习流程 ============

test.describe('学习流程', () => {
  test('开始学习显示单词卡片', async ({ page }) => {
    await enterLearning(page);

    // 单词标题非空
    const word = await getCurrentWord(page);
    expect(word.length).toBeGreaterThan(0);

    // 进度条显示（试用版每词表限 200 词；自动播放可能已推进 1-2 词，不断言具体索引）
    await expect(page.getByText(/\d+ \/ 200/)).toBeVisible();
    await expect(page.getByText('第 1 轮')).toBeVisible();

    // 发音按钮存在
    await expect(page.getByLabel('发音')).toBeVisible();

    // 底部控制按钮
    await expect(page.getByRole('button', { name: /暂停朗读|自动朗读/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '已掌握', exact: true })).toBeVisible();
  });

  test('键盘快捷键切换单词', async ({ page }) => {
    await enterLearning(page);
    const word1 = await getCurrentWord(page);

    // → 下一个
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.word-title')).not.toHaveText(word1);
    const word2 = await getCurrentWord(page);

    // ← 上一个，回到第一个
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.word-title')).toHaveText(word1);

    // 再 → 回到第二个
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.word-title')).toHaveText(word2);
  });

  test('暂停与继续朗读', async ({ page }) => {
    await enterLearning(page);

    // 开始学习后默认播放中
    const toggleBtn = page.getByRole('button', { name: /暂停朗读|自动朗读/ });
    await expect(toggleBtn).toContainText('暂停朗读');

    // 点击暂停
    await toggleBtn.click();
    await expect(page.getByRole('button', { name: /暂停朗读|自动朗读/ })).toContainText('自动朗读');

    // 空格键恢复
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: /暂停朗读|自动朗读/ })).toContainText('暂停朗读');

    // 空格键再暂停
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: /暂停朗读|自动朗读/ })).toContainText('自动朗读');
  });

  test('手动发音按钮触发音频请求', async ({ page }) => {
    await enterLearning(page);

    // 点击发音按钮，应触发有道音频请求
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('dict.youdao.com/dictvoice'),
      { timeout: 10000 }
    );
    await page.getByLabel('发音').click();
    const request = await requestPromise;
    expect(request.url()).toContain('audio=');
  });

  test('退出学习返回首页且进度保留', async ({ page }) => {
    await enterLearning(page);

    // 切到下一个单词
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    // 返回首页
    await page.getByLabel('返回首页').click();
    await expect(page.getByRole('heading', { name: '单词朗读' })).toBeVisible();

    // 按钮变为"继续学习"（进度已保存）
    await expect(page.getByRole('button', { name: /继续学习/ })).toBeVisible();
  });
});

// ============ 4. TTS 发音链路验证 ============

test.describe('TTS 发音', () => {
  test('英语自动朗读触发有道音频（单词发音）', async ({ page }) => {
    const ttsRequests: { url: string; status: number }[] = [];
    page.on('response', (res) => {
      if (res.url().includes('dict.youdao.com/dictvoice')) {
        ttsRequests.push({ url: res.url(), status: res.status() });
      }
    });

    await enterLearning(page);
    // 等待自动朗读触发
    await page.waitForTimeout(3000);

    expect(ttsRequests.length).toBeGreaterThan(0);
    expect(ttsRequests[0].status).toBe(200);
    expect(ttsRequests[0].url).toContain('type=2'); // 默认美式发音
  });

  test('德语自动朗读走有道音频（修复验证）', async ({ page }) => {
    await page.getByRole('button', { name: '德语' }).click();
    await expect(page.locator('span:text-is("D")')).toBeVisible();

    const ttsRequests: { url: string; status: number }[] = [];
    page.on('response', (res) => {
      if (res.url().includes('dict.youdao.com/dictvoice')) {
        ttsRequests.push({ url: res.url(), status: res.status() });
      }
    });

    await enterLearning(page);
    await page.waitForTimeout(3000);

    // 德语第一个单词 "ich" 应通过有道音频发音且返回 200
    expect(ttsRequests.length).toBeGreaterThan(0);
    expect(ttsRequests[0].url).toContain('audio=ich');
    expect(ttsRequests[0].status).toBe(200);
  });

  test('开启朗读释义后触发百度中文 TTS', async ({ page }) => {
    const baiduRequests: { url: string; status: number }[] = [];
    page.on('response', (res) => {
      if (res.url().includes('fanyi.baidu.com/gettts')) {
        baiduRequests.push({ url: res.url(), status: res.status() });
      }
    });

    await enterLearning(page);
    await page.waitForTimeout(1000);

    // 通过设置 UI 开启"自动朗读释义"（模拟真实用户操作）
    await page.getByLabel('设置').click();
    await expect(page.getByText('自定义你的学习体验')).toBeVisible();
    await page
      .locator('label:has-text("自动朗读释义") + div')
      .getByRole('button', { name: '开启' })
      .click();
    await closeDrawer(page);

    // 设置变更后 autoplay 序列重跑：单词 → 500ms → 中文释义（百度 zh）
    await page.waitForTimeout(5000);

    const zhRequests = baiduRequests.filter((r) => r.url.includes('lan=zh'));
    expect(zhRequests.length).toBeGreaterThan(0);
    expect(zhRequests[0].status).toBe(200);
  });

  test('日语自动朗读触发百度日语音频', async ({ page }) => {
    await page.getByRole('button', { name: '日语' }).click();
    await expect(page.locator('span:text-is("日")')).toBeVisible();

    const baiduRequests: { url: string; status: number }[] = [];
    page.on('response', (res) => {
      if (res.url().includes('fanyi.baidu.com/gettts')) {
        baiduRequests.push({ url: res.url(), status: res.status() });
      }
    });

    await enterLearning(page);
    await page.waitForTimeout(3000);

    // 日语走百度 TTS（lan=jp）
    const jpRequests = baiduRequests.filter((r) => r.url.includes('lan=jp'));
    expect(jpRequests.length).toBeGreaterThan(0);
    expect(jpRequests[0].status).toBe(200);
  });

  test('自动播放完整顺序：单词→释义→例句（全量验证）', async ({ page }) => {
    // 记录所有 TTS 请求的顺序
    const ttsSequence: { type: 'youdao' | 'baidu'; url: string; status: number }[] = [];
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('dict.youdao.com/dictvoice')) {
        ttsSequence.push({ type: 'youdao', url, status: res.status() });
      } else if (url.includes('fanyi.baidu.com/gettts')) {
        ttsSequence.push({ type: 'baidu', url, status: res.status() });
      }
    });

    // 先进入学习，然后开启释义+例句（模拟用户操作）
    await enterLearning(page);
    await page.waitForTimeout(500);

    await page.getByLabel('设置').click();
    await expect(page.getByText('自定义你的学习体验')).toBeVisible();
    // 开启自动朗读释义
    await page
      .locator('label:has-text("自动朗读释义") + div')
      .getByRole('button', { name: '开启' })
      .click();
    // 开启自动朗读例句
    await page
      .locator('label:has-text("自动朗读例句") + div')
      .getByRole('button', { name: '开启' })
      .click();
    await closeDrawer(page);

    // 等待完整播放序列（单词~2s + 500ms + 释义~2s + 300ms + 例句~3s + 间隔）
    // 第一个单词 "n't" 无例句，第二个单词 "last" 有例句，等待足够长时间
    await page.waitForTimeout(15000);

    // 验证 1：有道请求存在（单词发音）
    const youdaoReqs = ttsSequence.filter((r) => r.type === 'youdao');
    expect(youdaoReqs.length).toBeGreaterThan(0);

    // 验证 2：百度中文请求存在（释义朗读）
    const baiduZhReqs = ttsSequence.filter((r) => r.type === 'baidu' && r.url.includes('lan=zh'));
    expect(baiduZhReqs.length).toBeGreaterThan(0);
    expect(baiduZhReqs[0].status).toBe(200);

    // 验证 3：百度英文请求存在且包含句子（例句朗读）——核心验证：例句必须被读出
    // 区分单词兆底（无空格）和例句（含空格 %20）
    const baiduEnSentenceReqs = ttsSequence.filter(
      (r) => r.type === 'baidu' && r.url.includes('lan=en') && r.url.includes('%20')
    );
    expect(baiduEnSentenceReqs.length).toBeGreaterThan(0);
    expect(baiduEnSentenceReqs[0].status).toBe(200);

    // 验证 4：顺序正确——第一个例句请求之前必须有百度中文请求（释义）
    const firstEnSentenceIdx = ttsSequence.findIndex(
      (r) => r.type === 'baidu' && r.url.includes('lan=en') && r.url.includes('%20')
    );
    const zhBeforeEn = ttsSequence.slice(0, firstEnSentenceIdx).some((r) => r.type === 'baidu' && r.url.includes('lan=zh'));
    expect(zhBeforeEn).toBe(true);

    // 验证 5：顺序正确——第一个百度中文请求（释义）之前必须有 TTS 请求（单词发音）
    const firstZhIdx = ttsSequence.findIndex((r) => r.type === 'baidu' && r.url.includes('lan=zh'));
    expect(firstZhIdx).toBeGreaterThan(0); // 释义不是第一个请求，前面有单词发音
  });
});

// ============ 5. 设置面板 ============

test.describe('设置面板', () => {
  test('打开设置并修改间隔和语速', async ({ page }) => {
    await enterLearning(page);

    await page.getByLabel('设置').click();
    await expect(page.getByText('自定义你的学习体验')).toBeVisible();

    // 修改间隔为 2s、语速为 1.25x
    await page.getByRole('button', { name: '2s', exact: true }).click();
    await page.getByRole('button', { name: '1.25x' }).click();
    await closeDrawer(page);

    // 验证持久化到 localStorage
    const settings = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vocab_settings') || '{}')
    );
    expect(settings.speed).toBe(2);
    expect(settings.speechRate).toBe(1.25);
  });

  test('切换自动朗读释义和例句开关', async ({ page }) => {
    await enterLearning(page);
    await page.getByLabel('设置').click();

    // 开启"自动朗读释义"
    await page
      .locator('label:has-text("自动朗读释义") + div')
      .getByRole('button', { name: '开启' })
      .click();
    // 开启"自动朗读例句"
    await page
      .locator('label:has-text("自动朗读例句") + div')
      .getByRole('button', { name: '开启' })
      .click();
    await closeDrawer(page);

    // 验证 localStorage 已保存
    const settings = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vocab_settings') || '{}')
    );
    expect(settings.readDefinition).toBe(true);
    expect(settings.readExample).toBe(true);
  });

  test('重置进度需要二次确认', async ({ page }) => {
    await enterLearning(page);
    await page.getByLabel('设置').click();

    await page.getByRole('button', { name: '重置进度' }).click();
    // 确认弹窗出现
    await expect(page.getByText('确定要重置所有学习进度吗？')).toBeVisible();

    // 取消不重置
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByText('确定要重置所有学习进度吗？')).not.toBeVisible();
  });

  test('口音切换（英式/美式）', async ({ page }) => {
    await enterLearning(page);
    await page.getByLabel('设置').click();

    // 切换到英式
    await page.getByRole('button', { name: '英式' }).click();
    await closeDrawer(page);

    // 单词卡片上口音标签变为 UK
    await expect(page.locator('.word-title')).toBeVisible();
    await expect(page.getByText('UK')).toBeVisible();
  });
});

// ============ 6. 词表选择 ============

test.describe('词表选择', () => {
  test('打开词表弹窗并选择托福词表', async ({ page }) => {
    await page.getByRole('button', { name: /按词表学习/ }).click();
    await expect(page.getByText('选择词表')).toBeVisible();

    // 托福词表可见且有词数统计
    await expect(page.getByText('托福词汇')).toBeVisible();

    // 点击托福 → 直接进入学习模式
    await page.getByText('托福词汇').click();
    await expect(page.locator('.word-title')).toBeVisible();

    // 进度条显示托福词汇
    await expect(page.getByText('托福词汇')).toBeVisible();
  });

  test('日语词表显示 JLPT 分级', async ({ page }) => {
    await page.getByRole('button', { name: '日语' }).click();
    await expect(page.locator('span:text-is("日")')).toBeVisible();

    await page.getByRole('button', { name: /按词表学习/ }).click();
    await expect(page.getByText('选择词表')).toBeVisible();

    for (const level of ['JLPT N5', 'JLPT N4', 'JLPT N3', 'JLPT N2', 'JLPT N1']) {
      await expect(page.getByText(level, { exact: true })).toBeVisible();
    }
  });

  test('选择德语 A1 词表进入学习', async ({ page }) => {
    await page.getByRole('button', { name: '德语' }).click();
    await expect(page.locator('span:text-is("D")')).toBeVisible();

    await page.getByRole('button', { name: /按词表学习/ }).click();
    await page.getByText('A1 入门').click();
    await expect(page.locator('.word-title')).toBeVisible();

    // 进度条显示 A1 入门
    await expect(page.getByText('A1 入门')).toBeVisible();
  });
});

// ============ 7. 已掌握单词 ============

test.describe('已掌握单词', () => {
  test('标记掌握后单词被跳过', async ({ page }) => {
    await enterLearning(page);
    const word1 = await getCurrentWord(page);

    // 标记掌握 → 自动跳到下一个
    await page.getByRole('button', { name: '已掌握', exact: true }).click();
    await page.waitForTimeout(500);
    const word2 = await getCurrentWord(page);
    expect(word2).not.toBe(word1);

    // 继续下一个，不应回到 word1（已被跳过）
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    const word3 = await getCurrentWord(page);
    expect(word3).not.toBe(word1);
  });

  test('已掌握列表显示与取消掌握', async ({ page }) => {
    await enterLearning(page);
    const word1 = await getCurrentWord(page);

    await page.getByRole('button', { name: '已掌握', exact: true }).click();
    await page.waitForTimeout(500);

    // 打开已掌握列表
    await page.getByLabel('已掌握单词').click();
    await expect(page.getByText(/已掌握单词 \(1\)/)).toBeVisible();
    await expect(page.locator('h4', { hasText: word1 })).toBeVisible();

    // 还原（取消掌握）
    await page.getByRole('button', { name: '还原', exact: true }).click();
    await expect(page.getByText(/已掌握单词 \(0\)/)).toBeVisible();
  });
});

// ============ 8. 例句功能 ============

test.describe('例句功能', () => {
  test('单词卡片显示例句和翻译', async ({ page }) => {
    await enterLearning(page);
    // 例句区域（斜体文本）
    await expect(page.locator('p.italic')).toBeVisible();
    // 例句朗读按钮
    await expect(page.getByLabel('朗读例句')).toBeVisible();
  });

  test('例句朗读按钮触发音频请求', async ({ page }) => {
    await enterLearning(page);

    // 英语例句走百度 TTS（句子不走过道）
    const requestPromise = page.waitForRequest(
      (req) =>
        req.url().includes('dict.youdao.com/dictvoice') ||
        req.url().includes('fanyi.baidu.com/gettts'),
      { timeout: 10000 }
    );
    await page.getByLabel('朗读例句').click();
    const request = await requestPromise;
    expect(request.url()).toBeTruthy();
  });
});

// ============ 9. 软件激活 ============

test.describe('软件激活', () => {
  test('首页试用版入口打开激活弹窗', async ({ page }) => {
    await page.getByText(/试用版.*点击激活/).click();
    // 激活弹窗应可见
    await expect(page.getByText(/激活/).first()).toBeVisible();
  });

  test('设置中的激活入口', async ({ page }) => {
    await enterLearning(page);
    await page.getByLabel('设置').click();
    await page.getByText(/试用版 · 点击激活/).click();
    await expect(page.getByText(/激活/).first()).toBeVisible();
  });
});
