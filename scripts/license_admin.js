/**
 * 卡密管理脚本（卖家专用，勿外发）
 *
 * 用法（凭证通过环境变量传入，不要写进代码）：
 *   Windows PowerShell:
 *     $env:TCB_SECRET_ID="你的SecretId"; $env:TCB_SECRET_KEY="你的SecretKey"; $env:TCB_ENV_ID="你的环境ID"
 *   Git Bash / Linux:
 *     export TCB_SECRET_ID=... TCB_SECRET_KEY=... TCB_ENV_ID=...
 *
 *   node scripts/license_admin.js gen 50            生成 50 个卡密并入库（输出纯文本列表，可直接导入阿奇索）
 *   node scripts/license_admin.js list              查看全部卡密状态（销量统计）
 *   node scripts/license_admin.js revoke <卡密>     作废卡密（买家退款后执行，对方下次联网即被锁）
 *   node scripts/license_admin.js unbind <卡密>     解除设备绑定（买家换机售后）
 *
 * SecretId/SecretKey 在腾讯云控制台「访问管理 → API密钥管理」获取，环境 ID 在 CloudBase 控制台查看。
 */
import tcb from '@cloudbase/node-sdk';
import crypto from 'node:crypto';

const { TCB_SECRET_ID, TCB_SECRET_KEY, TCB_ENV_ID } = process.env;

if (!TCB_SECRET_ID || !TCB_SECRET_KEY || !TCB_ENV_ID) {
  console.error('请先设置环境变量 TCB_SECRET_ID / TCB_SECRET_KEY / TCB_ENV_ID');
  process.exit(1);
}

const app = tcb.init({ secretId: TCB_SECRET_ID, secretKey: TCB_SECRET_KEY, env: TCB_ENV_ID });
const db = app.database();
const licenses = db.collection('licenses');

// 去掉易混淆字符（0/O、1/I）的卡密字符集
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genCode() {
  const part = () =>
    Array.from(crypto.randomBytes(4)).map(b => CHARSET[b % CHARSET.length]).join('');
  return `VCAB-${part()}-${part()}`;
}

async function findByCode(code) {
  const { data } = await licenses.where({ code }).limit(1).get();
  return data[0] || null;
}

const [cmd, arg] = process.argv.slice(2);

switch (cmd) {
  case 'gen': {
    const count = Math.max(1, parseInt(arg || '10', 10));
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = genCode();
      await licenses.add({
        code,
        status: 'unused',      // unused → active → revoked
        deviceId: '',
        createdAt: new Date().toISOString(),
      });
      codes.push(code);
    }
    // 纯文本一行一个，方便直接复制进自动发货工具的卡密库存
    console.log(codes.join('\n'));
    console.error(`\n已生成 ${count} 个卡密`);
    break;
  }

  case 'list': {
    const { data } = await licenses.limit(1000).get();
    if (data.length === 0) {
      console.log('（暂无卡密）');
      break;
    }
    for (const lic of data) {
      const dev = lic.deviceId ? `绑定:${lic.deviceId.slice(0, 8)}…` : '未绑定';
      console.log(`${lic.code}  ${lic.status.padEnd(7)}  ${dev}  ${lic.activatedAt || lic.createdAt}`);
    }
    const used = data.filter(l => l.status !== 'unused').length;
    console.log(`\n共 ${data.length} 个，已售 ${used} 个`);
    break;
  }

  case 'revoke': {
    const code = (arg || '').trim().toUpperCase();
    const lic = await findByCode(code);
    if (!lic) { console.error('卡密不存在'); process.exit(1); }
    await licenses.doc(lic._id).update({
      status: 'revoked',
      revokedAt: new Date().toISOString(),
    });
    console.log(`已作废 ${code}，该买家下次联网校验时将自动降级回试用版`);
    break;
  }

  case 'unbind': {
    const code = (arg || '').trim().toUpperCase();
    const lic = await findByCode(code);
    if (!lic) { console.error('卡密不存在'); process.exit(1); }
    await licenses.doc(lic._id).update({ deviceId: '' });
    console.log(`已解绑 ${code}，买家可在新设备上重新激活`);
    break;
  }

  default:
    console.log('用法: node scripts/license_admin.js <gen <数量> | list | revoke <卡密> | unbind <卡密>>');
}
