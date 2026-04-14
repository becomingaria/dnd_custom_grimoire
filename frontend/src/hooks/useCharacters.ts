import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { charactersApi } from "@/api/characters"
import type {
    CreateCharacterInput,
    UpdateCharacterInput,
} from "@/types/character"
import type { Character } from "@/types/character"

const CHARS_KEY = "characters"

export function useCharacters() {
    return useQuery<
        { characters: Character[]; count: number },
        Error,
        Character[]
    >({
        queryKey: [CHARS_KEY],
        queryFn: () => charactersApi.list(),
        select: (res) => res.characters,
        staleTime: 1000 * 60 * 5,
    })
}

export function useCharacter(characterId: string | undefined) {
    return useQuery({
        queryKey: [CHARS_KEY, characterId],
        queryFn: () => charactersApi.get(characterId!),
        enabled: !!characterId,
    })
}

export function useCreateCharacter() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (input: CreateCharacterInput) =>
            charactersApi.create(input),
        onSuccess: () => qc.invalidateQueries({ queryKey: [CHARS_KEY] }),
    })
}

export function useUpdateCharacter() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({
            characterId,
            input,
        }: {
            characterId: string
            input: UpdateCharacterInput
        }) => charactersApi.update(characterId, input),
        onSuccess: (
            _data: Character,
            {
                characterId,
            }: { characterId: string; input: UpdateCharacterInput },
        ) => {
            qc.invalidateQueries({ queryKey: [CHARS_KEY] })
            qc.invalidateQueries({ queryKey: [CHARS_KEY, characterId] })
        },
    })
}

export function useDeleteCharacter() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (characterId: string) => charactersApi.delete(characterId),
        onSuccess: () => qc.invalidateQueries({ queryKey: [CHARS_KEY] }),
    })
}

export function useTogglePreparedSpell() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({
            characterId,
            character,
            spellId,
        }: {
            characterId: string
            character: Character
            spellId: string
        }) =>
            charactersApi.togglePreparedSpell(characterId, character, spellId),
        onMutate: async ({ characterId, spellId }) => {
            await qc.cancelQueries({ queryKey: [CHARS_KEY, characterId] })
            const snapshot = qc.getQueryData<Character>([
                CHARS_KEY,
                characterId,
            ])
            if (snapshot) {
                const isPrepared = snapshot.preparedSpellIds.includes(spellId)
                qc.setQueryData<Character>([CHARS_KEY, characterId], {
                    ...snapshot,
                    preparedSpellIds: isPrepared
                        ? snapshot.preparedSpellIds.filter(
                              (id) => id !== spellId,
                          )
                        : [...snapshot.preparedSpellIds, spellId],
                })
            }
            return { snapshot }
        },
        onError: (_err, { characterId }, context) => {
            if (context?.snapshot) {
                qc.setQueryData([CHARS_KEY, characterId], context.snapshot)
            }
        },
        onSettled: (_data, _err, { characterId }) => {
            qc.invalidateQueries({ queryKey: [CHARS_KEY, characterId] })
        },
    })
}

export function useAddKnownSpell() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({
            characterId,
            character,
            spellId,
        }: {
            characterId: string
            character: Character
            spellId: string
        }) => charactersApi.addKnownSpell(characterId, character, spellId),
        onMutate: async ({ characterId, spellId }) => {
            await qc.cancelQueries({ queryKey: [CHARS_KEY, characterId] })
            const snapshot = qc.getQueryData<Character>([
                CHARS_KEY,
                characterId,
            ])
            if (snapshot) {
                qc.setQueryData<Character>([CHARS_KEY, characterId], {
                    ...snapshot,
                    knownSpellIds: [
                        ...new Set([...snapshot.knownSpellIds, spellId]),
                    ],
                })
            }
            return { snapshot }
        },
        onError: (_err, { characterId }, context) => {
            if (context?.snapshot) {
                qc.setQueryData([CHARS_KEY, characterId], context.snapshot)
            }
        },
        onSettled: (_data, _err, { characterId }) => {
            qc.invalidateQueries({ queryKey: [CHARS_KEY, characterId] })
        },
    })
}

export function useRemoveKnownSpell() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({
            characterId,
            character,
            spellId,
        }: {
            characterId: string
            character: Character
            spellId: string
        }) => charactersApi.removeKnownSpell(characterId, character, spellId),
        onMutate: async ({ characterId, spellId }) => {
            await qc.cancelQueries({ queryKey: [CHARS_KEY, characterId] })
            const snapshot = qc.getQueryData<Character>([
                CHARS_KEY,
                characterId,
            ])
            if (snapshot) {
                qc.setQueryData<Character>([CHARS_KEY, characterId], {
                    ...snapshot,
                    knownSpellIds: snapshot.knownSpellIds.filter(
                        (id) => id !== spellId,
                    ),
                    preparedSpellIds: snapshot.preparedSpellIds.filter(
                        (id) => id !== spellId,
                    ),
                })
            }
            return { snapshot }
        },
        onError: (_err, { characterId }, context) => {
            if (context?.snapshot) {
                qc.setQueryData([CHARS_KEY, characterId], context.snapshot)
            }
        },
        onSettled: (_data, _err, { characterId }) => {
            qc.invalidateQueries({ queryKey: [CHARS_KEY, characterId] })
        },
    })
}

export function useUpdateSpellNote() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({
            characterId,
            character,
            spellId,
            note,
        }: {
            characterId: string
            character: Character
            spellId: string
            note: string
        }) =>
            charactersApi.updateSpellNote(
                characterId,
                character,
                spellId,
                note,
            ),
        onMutate: async ({ characterId, spellId, note }) => {
            await qc.cancelQueries({ queryKey: [CHARS_KEY, characterId] })
            const snapshot = qc.getQueryData<Character>([
                CHARS_KEY,
                characterId,
            ])
            if (snapshot) {
                const spellNotes = { ...snapshot.spellNotes }
                if (note.trim()) {
                    spellNotes[spellId] = note.trim()
                } else {
                    delete spellNotes[spellId]
                }
                qc.setQueryData<Character>([CHARS_KEY, characterId], {
                    ...snapshot,
                    spellNotes,
                })
            }
            return { snapshot }
        },
        onError: (_err, { characterId }, context) => {
            if (context?.snapshot) {
                qc.setQueryData([CHARS_KEY, characterId], context.snapshot)
            }
        },
        onSettled: (_data, _err, { characterId }) => {
            qc.invalidateQueries({ queryKey: [CHARS_KEY, characterId] })
        },
    })
}
