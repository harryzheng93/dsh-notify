# Desktop notifications

Shows a Windows notification when a tool needs your approval or a turn finishes.
Clicking the notification brings the app window forward.

## What you see

- **Approval needed** with the requester's localized reason, or the tool name when
  the request carries no copy.
- **Turn finished** when a session stops running.

An approval notification is only a reminder; the request still appears in the
approval card and the decision stays yours. The same notice is never stacked
twice within two seconds.

## How it works

Windows only delivers a toast for an unpackaged application when the toast is
created with an Application User Model ID that a Start Menu shortcut registered.
DeepSeek Harness never sets one, so a notification created by the page is
accepted and then dropped by the system. This bundle raises the toast from the
host process through Windows PowerShell, under the identity the Start Menu
shortcut already registers, and points the click at the app's own `dsh:` protocol.
The running app holds a single-instance lock, so the click focuses the existing
window instead of opening a second copy.

## Config

Optional fields on the bundle's row in `cordis.patch.yml`:

- `aumid` — Application User Model ID to send under; default `electron.app.DeepSeek Harness`.
- `launch` — URI a click activates; default `dsh://open`.
- `language` — `zh`, `en`, or `auto`; default `auto`, which follows the host locale.
- `debug` — write `dsh-desktop-notify.log` into the temporary directory, with each event and the PowerShell exit code.

## Limitations

- Windows only; other platforms load the bundle and do nothing.
- Every finished turn notifies, including while the window is in front.
- Subagent turns notify as well; the host cannot tell them apart from conversations.
- A renamed installation or a different app identity needs `config.aumid`.
- There is no interface; disable the bundle in Plugins settings to stop it.
