import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { spellsApi, type SpellFilters, type SpellsResponse } from "@/api/spells"
import type { Spell, CreateSpellInput, UpdateSpellInput } from "@/types/spell"

export type { SpellFilters }

const SPELLS_KEY = "spells"

/** Standard hook — used when filters are active or a single spell is needed. */
export function useSpells(filters?: SpellFilters) {
    return useQuery<SpellsResponse, Error, Spell[]>({
        queryKey: [SPELLS_KEY, filters],
        queryFn: () => spellsApi.list(filters),
        select: (res) => res.spells,
        staleTime: 1000 * 60 * 5,
    })
}

/**
 * Two-phase progressive hook for the unfiltered "all spells" view.
 *
 * Phase 1 → fetches the first 50 spells (resolves quickly).
 * Phase 2 → immediately fires a background request for all remaining spells
 *            once phase 1 delivers a cursor (`lastKey`).
 *
 * Consumers receive spells from phase 1 almost instantly, then the list
 * silently expands when phase 2 completes.
 */
export function useSpellsProgressive(): {
    spells: Spell[]
    isLoading: boolean
    isLoadingMore: boolean
} {
    const firstPage = useQuery<SpellsResponse, Error>({
        queryKey: [SPELLS_KEY, "__page1__"],
        queryFn: () => spellsApi.list({ limit: 50 }),
        staleTime: 1000 * 60 * 5,
    })

    const lastKey = firstPage.data?.lastKey

    const restPage = useQuery<SpellsResponse, Error>({
        queryKey: [SPELLS_KEY, "__rest__", lastKey],
        queryFn: () => spellsApi.list({ startKey: lastKey }),
        enabled: firstPage.isSuccess && !!lastKey,
        staleTime: 1000 * 60 * 5,
    })

    const spells = useMemo<Spell[]>(() => {
        const first = firstPage.data?.spells ?? []
        const rest = restPage.data?.spells ?? []
        if (rest.length === 0) return first

        const seenIds = new Set(first.map((s) => s.spellId))
        const merged = [
            ...first,
            ...rest.filter((s) => !seenIds.has(s.spellId)),
        ]
        merged.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
        return merged
    }, [firstPage.data, restPage.data])

    return {
        spells,
        isLoading: firstPage.isLoading,
        isLoadingMore: firstPage.isSuccess && !!lastKey && !restPage.isSuccess,
    }
}

export function useSpell(spellId: string | undefined) {
    return useQuery({
        queryKey: [SPELLS_KEY, spellId],
        queryFn: () => spellsApi.get(spellId!),
        enabled: !!spellId,
    })
}

export function useCreateSpell() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateSpellInput) => spellsApi.create(input),
        onSuccess: () => qc.invalidateQueries({ queryKey: [SPELLS_KEY] }),
    })
}

export function useUpdateSpell() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({
            spellId,
            input,
        }: {
            spellId: string
            input: UpdateSpellInput
        }) => spellsApi.update(spellId, input),
        onSuccess: (_data, { spellId }) => {
            qc.invalidateQueries({ queryKey: [SPELLS_KEY] })
            qc.invalidateQueries({ queryKey: [SPELLS_KEY, spellId] })
        },
    })
}

export function useDeleteSpell() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (spellId: string) => spellsApi.delete(spellId),
        onSuccess: () => qc.invalidateQueries({ queryKey: [SPELLS_KEY] }),
    })
}
