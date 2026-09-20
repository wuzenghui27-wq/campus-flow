## 招迹 v1.0.15

- 新增 Apple 芯片 Mac（M 系列 / arm64）安装包，包含 DMG 和可解压的 app ZIP。
- Mac 数据保存在用户的 `~/Library/Application Support/招迹/`，替换应用不会覆盖资料。
- Mac 更新按钮打开下载页；Windows 保持自动下载安装。
- 保留 v1.0.14 的账号云同步、离线待同步、冲突处理和未保存表单保护。

### 安装

- Mac：下载 `campus-flow-1.0.15-mac-arm64.dmg`，将「招迹.app」拖到「应用程序」。也可解压同名 ZIP。
- Windows x64：下载 `campus-flow-setup-1.0.15.exe` 安装。
- 升级前关闭应用并备份数据。Mac 安装版与开发版使用不同本地目录；登录同一账号可获取已同步的文字资料，PDF 需重新选择。

### Mac 版本说明

当前使用本地临时签名，尚未配置 Apple 开发者签名和公证。如系统拦截，请在「系统设置 → 隐私与安全性」核对来源后允许打开。Mac 文字 PDF 提取可用，扫描 PDF 的 OCR 目前仅支持 Windows。此安装包不适用于 Intel Mac。

本机 42 项自动测试通过，Mac app 已启动验收，DMG / ZIP 完整性及 app 临时签名校验通过。两台真实设备的同步及 Windows 安装后的交互仍待实机验收。
