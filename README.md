# 招迹

一款本地优先的 Windows / macOS 校招投递管理应用。用中文像素风工作台记录投递、跟进进度、整理简历和个人资料，未登录时可使用独立的本机工作区；登录后可同步投递记录；新版个人信息全文保存在本机。

[下载安装](https://github.com/wuzenghui27-wq/campus-flow/releases) · [反馈问题](https://github.com/wuzenghui27-wq/campus-flow/issues)

## 功能

- **投递管理**：新增、编辑和删除记录，记录公司、职位、城市、日期和招聘网站。
- **状态跟踪**：支持「已投递」「笔试」「面试」「录用」「未通过」。
- **同公司多岗位**：复制公司信息、清空职位后另存，减少重复填写。
- **数据统计**：查看总投递、进行中、录用、流程分布和公司汇总。
- **个人信息**：读取 PDF 全文，在同一区域切换文字和原版，整篇编辑、复制与保存。
- **账号与云同步**：各账号使用独立的本地副本；投递记录同步到 Firestore（已有分字段资料仍保留，新版整篇正文只存本机），离线修改在恢复连接后发送，冲突需选择版本。

## 界面预览

截图中的公司与投递均为虚构演示数据。

### 像素边框工作台（v1.0.19）

去掉外围白色留边和顶栏小字，使用贴边像素边框与清晰的窗口按钮。

![招迹像素边框工作台](docs/screenshots/pixel-frame.png)

### 投递记录

![投递记录](docs/screenshots/applications.png)

### 数据统计

![数据统计](docs/screenshots/statistics.png)

### 已投递公司

![已投递公司统计](docs/screenshots/companies.png)

## 下载安装

1. 在 [Releases](https://github.com/wuzenghui27-wq/campus-flow/releases) 下载 `campus-flow-setup-版本号.exe`。
2. 运行安装包，按提示完成安装。
3. 从桌面或开始菜单的「招迹」快捷方式打开应用。

支持 Windows x64 和 Apple 芯片 Mac（arm64）。Mac 下载 `campus-flow-版本号-mac-arm64.dmg`，打开后将「招迹.app」拖入「应用程序」。也可下载同名 ZIP 解压得到 app。

Mac 版本目前没有 Apple 开发者签名和公证；如系统拦截，请在「系统设置 → 隐私与安全性」检查并允许打开你确认来源的应用。下载页以实际发布版本为准，可能与主分支代码不同。Windows 安装版支持选择安装位置。

> Windows 数据保存在「招迹数据」目录，Mac 安装版保存在 `~/Library/Application Support/招迹/`。升级前请备份数据。

## 使用方法

### 记录投递

打开「投递记录」，点击「新增投递」，填写公司、职位、城市、投递日期和当前状态。招聘网站为选填项，可在「已投递公司统计」中直接访问。

记录行上的状态下拉框可直接更新进度；编辑按钮用于修改详情，删除按钮会要求确认。点击加号，可沿用该公司的信息，为另一个职位新增记录。

「未通过」记录仍保留在总投递和公司统计中，不计入「进行中」或「录用」。填写时点击背景、切换窗口或被其他窗口遮挡不会丢失内容；明确关闭或保存成功后才结束填写，保存失败可重试。

### 管理简历与资料

在「个人信息」中直接编辑正文，或选择 PDF，整篇正文在一个可滚动区域预览，不拆分字段。点击「确认保存全文」后才替换已保存简历；预览、保存和复制使用同一份正文。支持编辑、恢复提取原文，以及「文字 / 原版」切换。原来的分字段表单已合并到此页面；没有PDF也能填写、保存。已有资料可以加入正文，确认前不会修改原数据。

文字页优先直接读取，只有没有文字的页面才调用本机 OCR：Mac 使用 Apple Vision，Windows 使用系统 OCR（可能需要中文识别语言组件）。扫描结果需要核对；纯文字无法还原字体、位置和双栏版式，可切换原版查看。部分页面失败会保留其他页的内容并提示具体原因。

取消、读取失败和保存失败不会覆盖已保存正文；切换页面保留未保存编辑。确认保存后重启仍可读取正文。正文、原始提取副本和 PDF 路径按账号保存在本机，不上传云端。

简历原文件移动或删除后，需要重新选择。

### 导入旧记录

登录自己的账号并连接云端后，如检测到旧版资料，可确认归属并导入。只追加云端缺失的记录和资料字段，不覆盖已有内容，原 `data.json` 保留。未登录工作区的新记录不会自动归入账号。

### 更新版本

联网启动后，应用会检查 GitHub Releases。有新版本时，侧栏显示更新按钮，Windows 点击后下载并安装；Mac 点击后打开发布页，下载新版并替换应用。更新检查和云同步需要网络，本地记录管理可离线使用。从 v1.0.14 起支持云同步；另一台电脑也需要安装支持云同步的版本。

## 数据保存

Mac 安装版数据位于 `~/Library/Application Support/招迹/`，独立于 app 保存，替换 app 不会删除资料。开发版仍使用项目旁的「招迹数据」目录；在安装版登录同一账号可取回已同步文字资料，PDF 需重新选择。

- 账号副本及待同步队列：`招迹数据/账号同步副本/<UID的SHA256>.json`，备份为同名 `.json.bak`。
- 未登录工作区：同目录下的 `guest.json`。
- 旧版 `data.json` 和 `data.json.bak` 保留，用于明确确认后的导入。
- 云端路径：`users/{uid}/entries/{entryId}`；发布根目录 `firestore.rules`，限制各账号仅访问自己的记录。
- 简历正文、原始提取副本和文件路径仅保存在本机，不上传 PDF。
- 备份或手动迁移数据前，请先正常关闭应用，再复制整个「招迹数据」目录。
- 卸载或更新程序时，请保留数据目录。

读取失败时会显示错误页和数据路径。请打开数据目录检查文件权限或备份，不要用空文件覆盖。保存失败时请根据提示处理后再退出。

## 本地开发

技术栈：React、TypeScript、Electron、Vite、electron-builder。

需要 Windows x64 或 Apple 芯片 Mac、Node.js 22 LTS 最新补丁版本和 npm。

```powershell
git clone https://github.com/wuzenghui27-wq/campus-flow.git
cd campus-flow
npm ci
npm run build
npm run desktop
```

```powershell
npm test          # 原有测试和同步测试
npx electron scripts/test-application-draft.cjs # 构建后运行表单回归测试，使用隔离数据
npm run build     # 类型检查和前端构建
npm run dist:win  # 生成 Windows 安装包
npm run dist:mac  # 在 Mac 生成 Apple 芯片版 DMG、ZIP 和 app
```

Electron 加载 `dist` 中的构建文件，修改前端后需要重新构建。`npm run dev` 仅启动 Vite，不包含桌面接口，不能替代完整应用。

安装包输出到 `release/`。创建并推送与 package.json 版本一致的 `v版本号` 标签，或在 GitHub Actions 手动运行「发布应用」，会分别在 Windows 和 macOS 自动测试、打包，两端成功后一起发布。发布前需更新 `RELEASE_NOTES.md`。
