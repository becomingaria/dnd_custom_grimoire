import { apiClient } from "./client"
import type {
    Character,
    CreateCharacterInput,
    UpdateCharacterInput,
} from "@/types/character"

interface CharactersResponse {
    characters: Character[]
    count: number
}

export const charactersApi = {
    list: () => apiClient.get<CharactersResponse>("/characters"),

    get: (characterId: string) =>
        apiClient.get<Character>(`/characters/${characterId}`),

    create: (input: CreateCharacterInput) =>
        apiClient.post<Character>("/characters", input),

    update: (characterId: string, input: UpdateCharacterInput) =>
        apiClient.put<Character>(`/characters/${characterId}`, input),

    delete: (characterId: string) =>
        apiClient.delete<{ message: string; characterId: string }>(
            `/characters/${characterId}`,
        ),

    // ─── Spell linking helpers ────────────────────────────────────────────────
    addKnownSpell: (
        characterId: string,
        character: Character,
        spellId: string,
    ) =>
        apiClient.put<Character>(`/characters/${characterId}`, {
            knownSpellIds: [...new Set([...character.knownSpellIds, spellId])],
        }),

    removeKnownSpell: (
        characterId: string,
        character: Character,
        spellId: string,
    ) =>
        apiClient.put<Character>(`/characters/${characterId}`, {
            knownSpellIds: character.knownSpellIds.filter(
                (id) => id !== spellId,
            ),
            preparedSpellIds: character.preparedSpellIds.filter(
                (id) => id !== spellId,
            ),
        }),

    togglePreparedSpell: (
        characterId: string,
        character: Character,
        spellId: string,
    ) => {
        const isPrepared = character.preparedSpellIds.includes(spellId)
        return apiClient.put<Character>(`/characters/${characterId}`, {
            preparedSpellIds: isPrepared
                ? character.preparedSpellIds.filter((id) => id !== spellId)
                : [...character.preparedSpellIds, spellId],
        })
    },

    updateSpellNote: (
        characterId: string,
        character: Character,
        spellId: string,
        note: string,
    ) => {
        const spellNotes = { ...character.spellNotes }
        if (note.trim()) {
            spellNotes[spellId] = note.trim()
        } else {
            delete spellNotes[spellId]
        }
        return apiClient.put<Character>(`/characters/${characterId}`, {
            spellNotes,
        })
    },
}
