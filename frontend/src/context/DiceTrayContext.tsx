import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { useLocalStorage } from "@/hooks/useLocalStorage"

export type TrayTab = "roll" | "cast"

/** Pre-fills the Conviction cast form, e.g. from a spell's "Cast" button. */
export interface CastRequest {
    spellName?: string
    spellLevel: number
    /** Changes on every request so the same spell can be re-requested. */
    nonce: number
}

export interface HistoryEntry {
    id: string
    at: number
    label: string
    detail: string
    total: number | string
}

interface DiceTrayValue {
    isOpen: boolean
    open: () => void
    close: () => void
    tab: TrayTab
    setTab: (t: TrayTab) => void
    /** Player opted into the Conviction casting variant for their rolls. */
    convictionEnabled: boolean
    setConvictionEnabled: (v: boolean) => void
    /** Character whose Conviction Score the tray reads and spends. */
    characterId: string | null
    setCharacterId: (id: string | null) => void
    castRequest: CastRequest | null
    castSpell: (req: { spellName?: string; spellLevel: number }) => void
    history: HistoryEntry[]
    addHistory: (e: Omit<HistoryEntry, "id" | "at">) => void
    clearHistory: () => void
}

const DiceTrayContext = createContext<DiceTrayValue | null>(null)
const HISTORY_LIMIT = 30

export function DiceTrayProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useLocalStorage("grimoire:dice:open", false)
    const [tab, setTab] = useLocalStorage<TrayTab>("grimoire:dice:tab", "roll")
    const [convictionEnabled, setConvictionEnabledRaw] = useLocalStorage(
        "grimoire:dice:conviction",
        false,
    )
    const [characterId, setCharacterId] = useLocalStorage<string | null>(
        "grimoire:dice:characterId",
        null,
    )
    const [history, setHistory] = useLocalStorage<HistoryEntry[]>(
        "grimoire:dice:history",
        [],
    )
    const [castRequest, setCastRequest] = useState<CastRequest | null>(null)

    const setConvictionEnabled = useCallback(
        (v: boolean) => {
            setConvictionEnabledRaw(v)
            if (!v) setTab("roll")
        },
        [setConvictionEnabledRaw, setTab],
    )

    const castSpell = useCallback(
        (req: { spellName?: string; spellLevel: number }) => {
            setCastRequest({ ...req, nonce: Date.now() })
            setConvictionEnabledRaw(true)
            setTab("cast")
            setIsOpen(true)
        },
        [setConvictionEnabledRaw, setTab, setIsOpen],
    )

    const addHistory = useCallback(
        (e: Omit<HistoryEntry, "id" | "at">) =>
            setHistory((prev) =>
                [
                    {
                        ...e,
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        at: Date.now(),
                    },
                    ...prev,
                ].slice(0, HISTORY_LIMIT),
            ),
        [setHistory],
    )

    return (
        <DiceTrayContext.Provider
            value={{
                isOpen,
                open: () => setIsOpen(true),
                close: () => setIsOpen(false),
                tab: convictionEnabled ? tab : "roll",
                setTab,
                convictionEnabled,
                setConvictionEnabled,
                characterId,
                setCharacterId,
                castRequest,
                castSpell,
                history,
                addHistory,
                clearHistory: () => setHistory([]),
            }}
        >
            {children}
        </DiceTrayContext.Provider>
    )
}

export function useDiceTray(): DiceTrayValue {
    const ctx = useContext(DiceTrayContext)
    if (!ctx) throw new Error("useDiceTray must be used within <DiceTrayProvider>")
    return ctx
}
