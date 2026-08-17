// electron-builder afterPack hook.
//
// We ship without an Apple Developer ID (no $99/yr account wired up), so
// electron-builder's own signing step is disabled (`identity: null` in
// electron-builder.yml). But a *completely* unsigned .app downloaded via a
// browser (which stamps it with the com.apple.quarantine xattr) gets
// rejected by Gatekeeper on current macOS with a misleading
// "…is damaged and can't be opened" dialog that offers no way to proceed —
// worse than the normal "unidentified developer" prompt, which at least has
// a right-click → Open path.
//
// Ad-hoc signing (no identity, signature is just "-") doesn't require an
// Apple account and isn't notarization, but it gives the bundle a valid
// signature structure so Gatekeeper falls back to the standard, overridable
// "unidentified developer" warning instead of the dead-end "damaged" one.
const { execFileSync } = require('node:child_process')
const path = require('node:path')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)

  console.log(`[afterPack] ad-hoc signing ${appPath}`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
}
