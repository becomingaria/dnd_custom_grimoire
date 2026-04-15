import { apiClient } from "./client"
import type { Spell, CreateSpellInput, UpdateSpellInput } from "@/types/spell"

export interface SpellsResponse {
    spells: Spell[]
    count: number
}

export interface SpellFilters {
    school?: string
    level?: number
    homebrew?: boolean
    class?: string
    source?: string
}

export const spellsApi = {
    list: (filters?: SpellFilters) => {
        const params = new URLSearchParams()
        if (filters?.school) params.set("school", filters.school)
        if (filters?.level !== undefined)
            params.set("level", String(filters.level))
        if (filters?.homebrew !== undefined)
            params.set("homebrew", String(filters.homebrew))
        if (filters?.class) params.set("class", filters.class)
        if (filters?.source) params.set("source", filters.source)
        const query = params.toString()
        return apiClient.get<SpellsResponse>(
            `/spells${query ? `?${query}` : ""}`,
        )
    },

    get: (spellId: string) => apiClient.get<Spell>(`/spells/${spellId}`),

    create: (input: CreateSpellInput) =>
        apiClient.post<Spell>("/spells", input),

    update: (spellId: string, input: UpdateSpellInput) =>
        apiClient.put<Spell>(`/spells/${spellId}`, input),

    delete: (spellId: string) =>
        apiClient.delete<{ message: string; spellId: string }>(
            `/spells/${spellId}`,
        ),
}
