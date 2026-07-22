# CloudBase 云激活部署手册

云激活后端：两个云函数 + 一个数据库集合，全部在腾讯云开发（CloudBase）免费额度内运行。
预计耗时 20–30 分钟，只需要浏览器操作。

## 1. 开通环境

1. 打开 [腾讯云开发控制台](https://console.cloud.tencent.com/tcb)，按提示开通（新用户选**按量计费**环境即可，有免费额度，本应用量级几乎不产生费用）。
2. 创建环境，记下**环境 ID**（形如 `vocab-1a2b3c4d`）。

## 2. 创建数据库集合

1. 控制台 → **数据库** → 新建集合，集合名：`licenses`。
2. 权限设置选**最严格的一档**（"仅管理端可读" / 自定义权限全部关闭）。
   客户端不直连数据库，所有读写都经云函数以管理员权限完成——这样卡密数据不可能从 App 端被窃取或篡改。

## 3. 部署云函数（两种方式选一）

### 方式 A：控制台在线粘贴（最简单）

对每个函数（`license-activate`、`license-validate`）：

1. 控制台 → **云函数** → 新建函数：名称填函数名，运行环境选 **Nodejs 16+**，内存 128MB 即可。
2. 打开本目录 `functions/<函数名>/index.js`，把全部内容粘贴到在线编辑器（替换模板代码）。
3. 在函数的「函数配置 → 依赖」或在线终端中安装依赖：`@cloudbase/node-sdk`（若编辑器提示缺少依赖，可在本地 `functions/<函数名>/` 目录运行 `npm install` 后按方式 B 部署）。
4. 保存并部署。

### 方式 B：命令行部署（推荐，可重复部署）

```bash
npm i -g @cloudbase/cli
tcb login                # 浏览器扫码授权
cd cloud/functions/license-activate && npm install
tcb fn deploy license-activate -e <你的环境ID>
cd ../license-validate && npm install
tcb fn deploy license-validate -e <你的环境ID>
```

## 4. 开启匿名登录

控制台 → **身份验证（或"登录授权"）→ 登录方式** → 启用**匿名登录**。
App 端仅用匿名身份换取调用云函数的凭证，不涉及任何用户信息。

## 5. 接入 App

把环境 ID 填入 `src/config/license.ts`：

```ts
export const CLOUDBASE_ENV_ID = 'vocab-1a2b3c4d'; // 你的环境 ID
export const PURCHASE_URL = 'https://你的闲鱼商品链接'; // 展示在激活弹窗
```

然后重新构建打包：`npm run build && npm run cap:sync`，用 Android Studio 出新 APK。

## 6. 验证（上线前必测）

1. 本地生成测试卡密：`node scripts/license_admin.js gen 2`（需先配好环境变量，见脚本头部注释）。
2. 手机上安装新 APK → 首页点"激活完整版"→ 输入卡密 → 应提示激活成功、词库解锁。
3. 执行 `node scripts/license_admin.js revoke <卡密>` → 杀掉 App 重新打开 → 应自动退回试用版（词表重新限 200 词）。
4. 同一卡密在另一台手机激活 → 应提示"已绑定其他设备"。

## 费用说明

按量计费环境下，云函数调用 0.000133 元/次量级 + 数据库少量读写，月销几百单时月成本通常在 1 元以内；闲置期为 0。匿名登录不收费。
