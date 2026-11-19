# dsh-notify

给 DeepSeek Harness 加 Windows 系统通知：需要授权时提醒、一轮对话跑完时提醒，
点通知把应用窗口拉回前台。

[English](README.md)

## 为什么不用浏览器通知

DeepSeek Harness 是未打包的 Electron 应用，主进程没有设置应用标识。渲染进程里
`new Notification()` 造出来的通知会被 Windows 直接丢弃：通知中心里什么都没有，
「设置 → 通知」里也不会出现这个应用。这是在一台真实安装上量出来的结论，不是推测。

所以插件改在宿主进程这侧，用开始菜单快捷方式已经注册好的身份
（`electron.app.DeepSeek Harness`）通过 Windows PowerShell 直接发 toast，并把通知的
点击动作设为应用自己注册的 `dsh:` 协议。应用持有单实例锁，所以点通知是把已经在跑的
窗口唤到前台，而不是再开一份。

## 提醒哪两件事

| 时机 | 标题 | 正文 |
|---|---|---|
| `approval/request` | 需要授权 / Approval needed | 请求方给的本地化说明，没有就显示工具名 |
| `turn/end` | 本轮完成 / Turn finished | 一句提示，让你回到应用看结果 |

相同内容在两秒内不会重复弹。授权那条只是提醒：请求照常进入界面里的授权卡片，
做决定仍然是你。

## 安装

在「设置 → 插件」里安装，或者用插件管理器：

```
plugin_manager install_bundle {"target": "dsh-notify"}   # npm
plugin_manager install_bundle {"target": "git+https://…"} # git
```

仅在 Windows 上生效；其它平台加载后什么也不做。

## 配置

所有字段都是可选的，写在 `cordis.patch.yml` 里这一行的 `config` 下：

```yaml
- id: desktop-notify
  name: dsh-notify
  config:
    aumid: electron.app.DeepSeek Harness   # 开始菜单快捷方式注册的身份
    launch: dsh://open                     # 点通知时激活的地址
    language: auto                         # zh | en | auto
    debug: false                           # 把诊断日志写进 %TEMP%
```

`aumid` 必须和开始菜单快捷方式注册的一致；如果通知静默消失，拿它和快捷方式的
`System.AppUserModel.ID` 对比一下。`debug: true` 会在临时目录写
`dsh-desktop-notify.log`，记录每次事件和 PowerShell 的退出码。

## 已知限制

- **只支持 Windows**：通知路径是 Windows PowerShell 加 WinRT。
- **不判断焦点**：每一轮结束都提醒，窗口在前台也提醒。
- **子代理轮次也会提醒**：宿主侧分辨不出子代理会话和普通会话。
- **身份是常量**：换了安装名或应用标识，需要改 `config.aumid`。
- **没有界面**：要关闭就在「设置 → 插件」里禁用。

## 开发

`index.js` 就是整个插件：`apply(ctx, config)` 订阅宿主事件并拉起 toast 脚本。
没有构建步骤，没有依赖。

## 许可证

MIT
