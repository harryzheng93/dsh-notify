# dsh-notify

Windows desktop notifications for DeepSeek Harness: a system notification when a
tool needs your approval, and when a turn finishes. Clicking the notification
brings the app window back to the front.

[中文说明](README.zh.md)

## Why it does not use the browser notification API

DeepSeek Harness is an unpackaged Electron application, and its main process
never sets an Application User Model ID. A toast created by the renderer is
accepted by `new Notification()` and then dropped by Windows: nothing appears in
the notification center and the app never shows up under **Settings →
Notifications**. This was measured on a real installation, not assumed.

The plugin therefore raises the toast from the host process through Windows
PowerShell, under the identity that the application's Start Menu shortcut
already registers (`electron.app.DeepSeek Harness`), and sets the toast's
activation to the app's own `dsh:` protocol. The running app holds a
single-instance lock, so activating the protocol focuses the existing window
instead of starting a second copy.

## What it announces

| Event | Title | Body |
|---|---|---|
| `approval/request` | Approval needed / 需要授权 | the requester's localized reason, or the tool name |
| `turn/end` | Turn finished / 本轮完成 | a short prompt to return to the app |

The same notice is never stacked twice within two seconds. Approval notifications
are passive: the request still goes to the approval card in the interface, and
the decision stays yours.

## Install

Add this index URL under **Plugins → Custom plugin indexes → Discover → Add index
source**, then install from the card:

```
https://raw.githubusercontent.com/harryzheng93/dsh-notify/main/market/index.json
```

Or install the bundle directly from the Plugins page, or through the plugin
manager:

```
plugin_manager install_bundle {"target": "dsh-notify"}   # npm
plugin_manager install_bundle {"target": "git+https://…"} # git
```

It is Windows only; on other platforms the plugin loads and does nothing.

## Config

Every field is optional and goes on the bundle's row in `cordis.patch.yml`:

```yaml
- id: desktop-notify
  name: dsh-notify
  config:
    aumid: electron.app.DeepSeek Harness   # registered by the Start Menu shortcut
    launch: dsh://open                     # toast click activation
    language: auto                         # zh | en | auto
    debug: false                           # write a diagnostic log to %TEMP%
```

`aumid` must match what the application's Start Menu shortcut registers; if a
toast silently disappears, compare it with the shortcut's
`System.AppUserModel.ID`. `debug: true` writes `dsh-desktop-notify.log` into the
temporary directory, including each event and the PowerShell exit code.

## Limitations

- **Windows only.** The toast path is Windows PowerShell and WinRT.
- **Not focus aware.** Every finished turn notifies, including while the window
  is in front.
- **Subagent turns notify too.** The host cannot tell a subagent session apart
  from a conversation.
- **The identity is a constant.** A renamed installation or a different app id
  needs `config.aumid`.
- **No interface.** To turn it off, disable the bundle in Plugins settings.

## Development

`index.js` is the whole plugin: `apply(ctx, config)` subscribes to the host
events and spawns the toast script. There is no build step and no dependency.

## License

MIT
