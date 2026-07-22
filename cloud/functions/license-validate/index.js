/**
 * 云函数 license-validate：启动时复核授权状态
 *
 * 入参: { code: string, deviceId: string }
 * 返回: { ok: true, status: 'active' | 'revoked' | 'device_mismatch' | 'not_found' }
 *
 * 客户端约定：status 非 'active' 时清除本地授权并降级回试用模式。
 */
const cloud = require('@cloudbase/node-sdk');

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV });
const db = app.database();

exports.main = async (event) => {
  const code = String(event.code || '').trim().toUpperCase();
  const deviceId = String(event.deviceId || '').trim();
  if (!code || !deviceId) {
    return { ok: true, status: 'not_found' };
  }

  const { data } = await db.collection('licenses').where({ code }).limit(1).get();
  if (data.length === 0) {
    return { ok: true, status: 'not_found' };
  }

  const lic = data[0];

  if (lic.status === 'revoked') {
    return { ok: true, status: 'revoked' };
  }
  if (!lic.deviceId || lic.deviceId !== deviceId) {
    // 本机缓存的授权与云端绑定设备不一致（异常/被换绑）
    return { ok: true, status: 'device_mismatch' };
  }

  return { ok: true, status: 'active' };
};
