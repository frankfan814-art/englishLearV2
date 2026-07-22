/**
 * 云函数 license-activate：卡密激活 + 设备绑定
 *
 * 入参: { code: string, deviceId: string }
 * 返回: { ok: boolean, message: string }
 *
 * 规则：
 * - 卡密不存在 → 拒绝
 * - 卡密已停用（revoked，退款后卖家作废）→ 拒绝
 * - 卡密已绑定其他设备 → 拒绝（换机需卖家先 unbind）
 * - 卡密未绑定 → 绑定当前设备并置 active
 * - 卡密已绑定当前设备 → 幂等成功（重复激活不报错）
 */
const cloud = require('@cloudbase/node-sdk');

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV });
const db = app.database();

exports.main = async (event) => {
  const code = String(event.code || '').trim().toUpperCase();
  const deviceId = String(event.deviceId || '').trim();
  if (!code || !deviceId) {
    return { ok: false, message: '参数缺失' };
  }

  const { data } = await db.collection('licenses').where({ code }).limit(1).get();
  if (data.length === 0) {
    return { ok: false, message: '激活码不存在，请核对后重试' };
  }

  const lic = data[0];

  if (lic.status === 'revoked') {
    return { ok: false, message: '该激活码已被停用，如有疑问请联系卖家' };
  }
  if (lic.deviceId && lic.deviceId !== deviceId) {
    return { ok: false, message: '该激活码已绑定其他设备，如需换机请联系卖家' };
  }

  if (!lic.deviceId) {
    await db.collection('licenses').doc(lic._id).update({
      deviceId,
      status: 'active',
      activatedAt: new Date().toISOString(),
    });
  }

  return { ok: true, message: '激活成功' };
};
