/**
 * 软件激活（云激活卡密制）配置
 *
 * 发售流程概览（详见 docs/闲鱼自动发货与云激活运营手册.md）：
 * 1. 买家在闲鱼付款 → 自动发货得到 APK 下载链接 + 卡密
 * 2. App 内输入卡密 → 云函数校验并绑定设备 → 解锁完整词库
 * 3. 每次启动联网校验，退款后卖家把卡密置为 revoked → 买家被降级回试用
 */

/** CloudBase 环境 ID（在腾讯云开发控制台创建环境后获得，形如 vocab-1a2b3c）。
 *  留空表示未配置云服务：App 保持试用模式，激活入口会提示"云服务未配置"。 */
export const CLOUDBASE_ENV_ID = '';

/** 试用模式每个词表可学习的单词数（未激活时截断到前 N 词） */
export const TRIAL_WORD_LIMIT = 200;

/** 离线宽限期（天）：距上次成功联网校验超过该天数则降级回试用，联网后自动恢复 */
export const LICENSE_GRACE_DAYS = 7;

/** 购买链接（闲鱼商品页），展示在激活弹窗中 */
export const PURCHASE_URL = '';

/** 授权状态：trial 试用 / active 已激活 */
export type LicenseState = 'trial' | 'active';

/** 本地持久化的授权信息（localStorage 键 vocab_license） */
export interface LicenseInfo {
  code: string;
  deviceId: string;
  activatedAt: string;
  lastValidatedAt: string;
}
