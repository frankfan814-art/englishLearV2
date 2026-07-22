/**
 * 云激活授权工具：卡密激活、启动校验、离线宽限、本地授权存取。
 *
 * 安全模型说明：卡密校验与绑定全部在 CloudBase 云函数内完成（数据库不对客户端开放），
 * 客户端只持有"本机已激活"的缓存凭证，退款后卖家撤销卡密，下次联网校验即失效。
 */
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import {
  CLOUDBASE_ENV_ID, LICENSE_GRACE_DAYS, LicenseInfo, LicenseState,
} from '../config/license';

const KEY_LICENSE = 'vocab_license';
const KEY_DEVICE_ID = 'vocab_device_id';

/** 构建期旁路：VITE_LICENSE_DISABLED=true 时全部视为已激活（仅限卖家自用/开发调试，
 *  正式发售的安装包严禁携带该变量，见 .env.local 说明） */
export function isLicenseBypassed(): boolean {
  return import.meta.env.VITE_LICENSE_DISABLED === 'true';
}

/** 云服务是否已配置（未配置时激活不可用，App 保持试用） */
export function isCloudConfigured(): boolean {
  return CLOUDBASE_ENV_ID.length > 0;
}

// ==== 设备 ID ====

let cachedDeviceId: string | null = null;

/**
 * 获取设备唯一标识：Android 原生取 ANDROID_ID（重装 App 不变，恢复出厂才变）；
 * Web/开发环境用 localStorage 持久化的随机 UUID 兜底。
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  if (Capacitor.isNativePlatform()) {
    try {
      const { identifier } = await Device.getId();
      if (identifier) {
        cachedDeviceId = identifier;
        return identifier;
      }
    } catch {
      // 原生接口失败时落到 UUID 兜底
    }
  }

  let id = localStorage.getItem(KEY_DEVICE_ID);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY_DEVICE_ID, id);
  }
  cachedDeviceId = id;
  return id;
}

// ==== 本地授权存取 ====

export function getStoredLicense(): LicenseInfo | null {
  try {
    const raw = localStorage.getItem(KEY_LICENSE);
    if (raw) return JSON.parse(raw);
  } catch {
    // 数据损坏视为无授权
  }
  return null;
}

function storeLicense(info: LicenseInfo): void {
  localStorage.setItem(KEY_LICENSE, JSON.stringify(info));
}

export function clearLicense(): void {
  localStorage.removeItem(KEY_LICENSE);
}

// ==== CloudBase 调用 ===

// CloudBase app 单例（仅在使用时初始化，避免未配置 env 时报错）
let cloudApp: cloudbase.app.App | null = null;

async function getCloudApp(): Promise<cloudbase.app.App> {
  if (!isCloudConfigured()) {
    throw new Error('云服务未配置');
  }
  if (!cloudApp) {
    // SDK 体积较大，按需动态加载：试用用户（从未激活）全程不会加载它
    const { default: cloudbase } = await import('@cloudbase/js-sdk');
    cloudApp = cloudbase.init({ env: CLOUDBASE_ENV_ID });
    // 匿名登录（需在 CloudBase 控制台开启匿名登录），只用于换取调云函数的凭证，不收集任何用户信息
    const auth = cloudApp.auth({ persistence: 'local' });
    const { error } = await auth.signInAnonymously();
    if (error) {
      cloudApp = null;
      throw new Error('匿名登录失败');
    }
  }
  return cloudApp;
}

/** 云函数返回体的约定结构 */
interface CloudResult {
  ok: boolean;
  message?: string;
  status?: 'active' | 'revoked' | 'not_found' | 'device_mismatch';
}

async function callLicenseFunction(name: string, data: Record<string, string>): Promise<CloudResult> {
  const app = await getCloudApp();
  const res = await app.callFunction({ name, data });
  return (res.result || {}) as CloudResult;
}

// ==== 激活 / 校验 ====

/** 规范化卡密输入：去空白、转大写（买家可能复制到空格或换行） */
export function normalizeCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

export interface ActivateResult {
  ok: boolean;
  message: string;
}

/**
 * 用卡密激活当前设备。
 * 成功：写入本地授权并返回 ok；失败：返回可直接展示给用户的中文原因。
 */
export async function activateLicense(rawCode: string): Promise<ActivateResult> {
  const code = normalizeCode(rawCode);
  if (code.length < 6) {
    return { ok: false, message: '请输入完整的激活码' };
  }
  if (!isCloudConfigured()) {
    return { ok: false, message: '云服务未配置，暂无法激活' };
  }

  const deviceId = await getDeviceId();
  try {
    const result = await callLicenseFunction('license-activate', { code, deviceId });
    if (!result.ok) {
      return { ok: false, message: result.message || '激活失败，请稍后再试' };
    }
    const now = new Date().toISOString();
    storeLicense({ code, deviceId, activatedAt: now, lastValidatedAt: now });
    return { ok: true, message: '激活成功，已解锁全部词库' };
  } catch {
    return { ok: false, message: '网络异常，请检查网络后重试' };
  }
}

/**
 * 启动时校验授权状态：
 * - 无本地授权 → trial
 * - 有授权且联网校验通过 → active（刷新校验时间）
 * - 授权被撤销 / 设备不匹配 → 清除本地授权 → trial
 * - 网络失败 → 按离线宽限期判定（宽限内仍 active，超期降级 trial，联网后自动恢复）
 */
export async function validateLicenseOnStart(): Promise<LicenseState> {
  if (isLicenseBypassed()) return 'active';

  const license = getStoredLicense();
  if (!license) return 'trial';

  if (isCloudConfigured()) {
    try {
      const result = await callLicenseFunction('license-validate', {
        code: license.code,
        deviceId: license.deviceId,
      });
      if (result.ok && result.status === 'active') {
        storeLicense({ ...license, lastValidatedAt: new Date().toISOString() });
        return 'active';
      }
      // revoked / not_found / 设备不匹配：本地授权作废
      clearLicense();
      return 'trial';
    } catch {
      // 网络异常，走离线宽限
    }
  }

  return withinGracePeriod(license) ? 'active' : 'trial';
}

/** 是否在离线宽限期内（距上次成功校验 ≤ LICENSE_GRACE_DAYS 天） */
function withinGracePeriod(license: LicenseInfo): boolean {
  const last = Date.parse(license.lastValidatedAt);
  if (Number.isNaN(last)) return false;
  return Date.now() - last <= LICENSE_GRACE_DAYS * 24 * 60 * 60 * 1000;
}
