# Lectern

A local Windows desktop teleprompter for recording lectures. Built with the same Electron, electron-builder NSIS installer, electron-updater, and GitHub Releases architecture as Paperly.

## Use

Open a Markdown or text script, or type directly into the editor. Select your webcam's monitor, keep **Dock at top** enabled, and use camera offset to align the text beneath the lens. Open the prompter and press Play. Undock to drag or resize the panel. Scripts and reading position are saved on this computer in `%APPDATA%/lectern/lecture.json`; Export creates a separate Markdown copy.

Global controls work while another application has focus:

| Shortcut | Action |
| --- | --- |
| Ctrl Alt Space | Play/pause |
| Ctrl Alt Left / Right | Back/forward three lines; pause for a retake |
| Ctrl Alt Up / Down | Increase/decrease speed |
| Ctrl Alt Home | Restart and pause |

Markdown headings become navigation buttons. Scrolling starts after the selected countdown. Text is rendered safely as plain text; common Markdown formatting and Obsidian link syntax are simplified. Voice following and video recording are outside this first version; use your existing recorder alongside Lectern.

Screen-capture exclusion is enabled by default using Electron's Windows content-protection API. Verify it with a short recording in your capture software; capture methods differ. Toggle it off if you deliberately want the prompter in a recording.

## Development

Requires Node.js 22+ on Windows.

```powershell
npm ci
npm test
npm start
npm run smoke
npm run build
```

The smoke check runs the real Electron windows with temporary application data, exercises playback and synchronization, and writes `smoke-result.json` and screenshots. The installer is `dist/Lectern-Setup-0.1.0.exe`.

## GitHub releases and updates

The configured feed is `chickman72/Lectern`. Version tags trigger `.github/workflows/release.yml`, which tests and builds on Windows, checks all updater artifacts, uploads them into a draft release, then publishes it. The installer, `.exe.blockmap`, and `latest.yml` must be published together. Never replace an already published version; increase the package version and create a new tag.

Installed builds check for updates shortly after startup. Download and installation are explicit actions; quitting does not silently install an update. Installation is blocked while the prompter is playing or counting down. Scripts are saved before restart. Development builds do not contact the update feed.

```powershell
npm version patch
git push origin main --follow-tags
```

For signing, configure repository secrets `WINDOWS_CSC_LINK` and `WINDOWS_CSC_KEY_PASSWORD`. Without a certificate, installers are unsigned. No GitHub token is embedded in the application; the updater requires publicly accessible releases.
