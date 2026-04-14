import { useState, useCallback } from "react"

/**
 * useState that also syncs the value to localStorage.
 * On mount the initial value is read from storage (if present).
 */
export function useLocalStorage<T>(key: string, defaultValue: T) {
    const [value, setValue] = useState<T>(() => {
        try {
            const stored = localStorage.getItem(key)
            return stored !== null ? (JSON.parse(stored) as T) : defaultValue
        } catch {
            return defaultValue
        }
    })

    const set = useCallback(
        (nextValue: T | ((prev: T) => T)) => {
            setValue((prev) => {
                const resolved =
                    typeof nextValue === "function"
                        ? (nextValue as (p: T) => T)(prev)
                        : nextValue
                try {
                    localStorage.setItem(key, JSON.stringify(resolved))
                } catch {
                    // storage unavailable — degrade gracefully
                }
                return resolved
            })
        },
        [key],
    )

    return [value, set] as const
}
