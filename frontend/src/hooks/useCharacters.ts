import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { charactersApi } from '@/api/characters';
import type { CreateCharacterInput, UpdateCharacterInput } from '@/types/character';
import type { Character } from '@/types/character';

const CHARS_KEY = 'characters';

export function useCharacters() {
  return useQuery({
    queryKey: [CHARS_KEY],
    queryFn:  () => charactersApi.list(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCharacter(characterId: string | undefined) {
  return useQuery({
    queryKey: [CHARS_KEY, characterId],
    queryFn:  () => charactersApi.get(characterId!),
    enabled:  !!characterId,
  });
}

export function useCreateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCharacterInput) => charactersApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [CHARS_KEY] }),
  });
}

export function useUpdateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      characterId,
      input,
    }: {
      characterId: string;
      input: UpdateCharacterInput;
    }) => charactersApi.update(characterId, input),
    onSuccess: (_data: Character, { characterId }: { characterId: string; input: UpdateCharacterInput }) => {
      qc.invalidateQueries({ queryKey: [CHARS_KEY] });
      qc.invalidateQueries({ queryKey: [CHARS_KEY, characterId] });
    },
  });
}

export function useDeleteCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (characterId: string) => charactersApi.delete(characterId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [CHARS_KEY] }),
  });
}

export function useTogglePreparedSpell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      characterId,
      character,
      spellId,
    }: {
      characterId: string;
      character: Character;
      spellId: string;
    }) => charactersApi.togglePreparedSpell(characterId, character, spellId),
    onSuccess: (_data: Character, { characterId }: { characterId: string; character: Character; spellId: string }) => {
      qc.invalidateQueries({ queryKey: [CHARS_KEY, characterId] });
    },
  });
}
