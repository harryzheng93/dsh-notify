/**
 * Host half of the desktop-notify bundle.
 *
 * Windows only delivers a toast for an unpackaged application when the toast is
 * created with an Application User Model ID that a Start Menu shortcut
 * registered. Electron's renderer notifications carry no such identity for
 * DeepSeek Harness, so this plugin raises the toast itself through Windows
 * PowerShell, using the identity the application's Start Menu shortcut already
 * registers, and points the toast's activation at the app's own `dsh:` protocol
 * so a click brings the window forward.
 *
 * Two facts are announced:
 * - `approval/request`: a tool needs the user's decision;
 * - a Session's `turn/end`: a turn finished.
 *
 * Config (all optional):
 * - `aumid`: Application User Model ID to send under;
 * - `launch`: URI the toast activates with a click;
 * - `language`: `zh`, `en`, or `auto` (the host locale);
 * - `debug`: write a diagnostic log to the temp directory.
 */
import { spawn } from 'node:child_process'
import { appendFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Application identity registered by the DeepSeek Harness Start Menu shortcut. */
const DEFAULT_AUMID = 'electron.app.DeepSeek Harness'

/** URI the shipped desktop app activates to bring its main window forward. */
const DEFAULT_LAUNCH = 'dsh://open'

/** Interpreter that owns the WinRT toast projection on Windows. */
const POWERSHELL = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`

/** Copy for the two notification kinds, in both shipped languages. */
const STRINGS = {
  zh: {
    approvalTitle: '需要授权',
    approvalBody: '「{tool}」等待你确认',
    approvalFallback: '有一个请求正在等待你确认',
    turnTitle: '本轮完成',
    turnBody: '回到 DeepSeek Harness 查看结果',
  },
  en: {
    approvalTitle: 'Approval needed',
    approvalBody: '{tool} is waiting for your decision',
    approvalFallback: 'A request is waiting for your decision',
    turnTitle: 'Turn finished',
    turnBody: 'Return to DeepSeek Harness to see the result',
  },
}

/** ASCII-only toast script; the text, identity, and activation arrive through environment variables. */
const TOAST_SCRIPT = `$ErrorActionPreference = 'Stop'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime] | Out-Null
function Esc([string]$s) { return $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;') }
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml("<toast activationType=""protocol"" launch=""" + (Esc $env:DSH_TOAST_LAUNCH) + """><visual><binding template=""ToastGeneric""><text>" + (Esc $env:DSH_TOAST_TITLE) + "</text><text>" + (Esc $env:DSH_TOAST_BODY) + "</text></binding></visual></toast>")
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($env:DSH_TOAST_AUMID).Show($toast)
`

/**
 * Resolve the copy language.
 * @param choice - configured `language`, or absence for the host locale.
 * @returns the dictionary to use.
 */
function stringsFor(choice) {
  if (choice === 'zh' || choice === 'en') return STRINGS[choice]
  let tag = ''
  try {
    tag = Intl.DateTimeFormat().resolvedOptions().locale ?? ''
  } catch {
    tag = ''
  }
  return /^zh/i.test(tag) ? STRINGS.zh : STRINGS.en
}

/**
 * Fill `{name}` placeholders in one template.
 * @param template - dictionary value.
 * @param params - substitution values.
 * @returns the filled text.
 */
function fill(template, params) {
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
}

/**
 * Pick the localized presentation text a request supplied.
 * @param displayReason - requester-owned localized copy.
 * @param language - resolved dictionary key.
 * @returns the matching language's text, falling back to English.
 */
function reasonText(displayReason, language) {
  if (!displayReason || typeof displayReason !== 'object') return ''
  return displayReason[language] ?? displayReason.en ?? ''
}

/**
 * Install the approval and turn-completion notifications.
 * @param ctx - Host context.
 * @param config - optional row config; see the module description.
 */
export function apply(ctx, config = {}) {
  const logger = ctx.logger
  const settings = config ?? {}
  const aumid = typeof settings.aumid === 'string' && settings.aumid !== '' ? settings.aumid : DEFAULT_AUMID
  const launch = typeof settings.launch === 'string' && settings.launch !== '' ? settings.launch : DEFAULT_LAUNCH
  const language = settings.language === 'zh' ? 'zh' : (settings.language === 'en' ? 'en' : 'auto')
  const strings = stringsFor(language)
  const dictionary = language === 'auto' ? (strings === STRINGS.zh ? 'zh' : 'en') : language
  const debug = settings.debug === true
  const scriptPath = join(tmpdir(), 'dsh-desktop-notify-toast.ps1')
  const logPath = join(tmpdir(), 'dsh-desktop-notify.log')

  if (process.platform !== 'win32') return

  const log = (line) => {
    if (!debug) return
    try {
      appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`)
    } catch {}
  }

  try {
    writeFileSync(scriptPath, TOAST_SCRIPT, 'ascii')
  } catch (error) {
    logger?.warn?.(`desktop-notify: cannot write the toast script: ${error.message}`)
    return
  }

  log(`apply pid=${process.pid} aumid=${aumid} launch=${launch}`)

  /** Sessions observed running, so a status stop can be recognized as a finished turn. */
  const running = new Set()
  let lastAt = 0
  let lastKey = ''

  /**
   * Raise one toast under the configured identity.
   * @param title - notification title.
   * @param body - notification body.
   */
  function toast(title, body) {
    log(`toast title=${title} body=${body}`)
    try {
      const child = spawn(
        POWERSHELL,
        ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        {
          env: {
            ...process.env,
            DSH_TOAST_TITLE: title,
            DSH_TOAST_BODY: body,
            DSH_TOAST_AUMID: aumid,
            DSH_TOAST_LAUNCH: launch,
          },
          stdio: debug ? 'pipe' : 'ignore',
          windowsHide: true,
        },
      )
      child.on('error', (error) => {
        log(`spawn error ${error.message}`)
        logger?.warn?.(`desktop-notify: toast launch failed: ${error.message}`)
      })
      if (debug) {
        let stderr = ''
        child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
        child.on('close', (code) => {
          log(`spawn exit=${code}${stderr === '' ? '' : ` stderr=${stderr.replace(/\s+/g, ' ').slice(0, 400)}`}`)
        })
      }
      child.unref()
    } catch (error) {
      log(`spawn threw ${error.message}`)
      logger?.warn?.(`desktop-notify: toast launch failed: ${error.message}`)
    }
  }

  /**
   * Announce one event, dropping an identical notice repeated within two seconds.
   * @param title - notification title.
   * @param body - notification body.
   */
  function announce(title, body) {
    const now = Date.now()
    const key = `${title}\n${body}`
    if (key === lastKey && now - lastAt < 2000) {
      log(`announce dropped duplicate ${title}`)
      return
    }
    lastAt = now
    lastKey = key
    toast(title, body)
  }

  ctx.on('approval/request', (request, next) => {
    const reason = reasonText(request?.displayReason, dictionary)
    const tool = typeof request?.toolName === 'string' && request.toolName !== '' ? request.toolName : ''
    const body = reason !== ''
      ? reason
      : (tool !== '' ? fill(strings.approvalBody, { tool }) : strings.approvalFallback)
    log(`event approval/request tool=${tool === '' ? '?' : tool}`)
    announce(strings.approvalTitle, body)
    return next()
  })

  ctx.on('session/event', (session, event) => {
    if (event?.type !== 'turn/end') return
    log(`event session/event turn/end session=${session?.id ?? '?'}`)
    announce(strings.turnTitle, strings.turnBody)
  })

  ctx.on('api-session/status', (sessionId, isRunning) => {
    if (isRunning) {
      running.add(sessionId)
      return
    }
    if (!running.delete(sessionId)) return
    announce(strings.turnTitle, strings.turnBody)
  })
}
