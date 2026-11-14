/**
 * Runs the Patreon access sync on a schedule (EventBridge, every 6 hours).
 * Does nothing unless an admin has connected Patreon and turned it on.
 */
import { loadCredentials } from "../shared/patreon-client"
import { loadSettings, runSync } from "../shared/patreon-sync"

export const handler = async () => {
    const settings = await loadSettings()
    if (settings.mode === "off") return { skipped: "mode is off" }
    if (!(await loadCredentials())) return { skipped: "not connected" }

    const { report } = await runSync(settings)
    console.log(
        JSON.stringify({
            ok: report.ok,
            error: report.error,
            mode: report.mode,
            patrons: report.patronCount,
            disabled: report.disabled.length,
            enabled: report.enabled.length,
            enforcementSkipped: report.enforcementSkipped,
        }),
    )
    return { ok: report.ok }
}
