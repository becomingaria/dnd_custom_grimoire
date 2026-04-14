import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { spellsApi, type SpellFilters } from '@/api/spells';
import type { CreateSpellInput, UpdateSpellInput } from '@/types/spell';

const SPELLS_KEY = 'spells';

export function useSpells(filters?: SpellFilters) {
  return useQuery({
    queryKey: [SPELLS_KEY, filters],
    queryFn:  () => spellsApi.list(filters),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSpell(spellId: string | undefined) {
  return useQuery({
    queryKey: [SPELLS_KEY, spellId],
    queryFn:  () => spellsApi.get(spellId!),
    enabled:  !!spellId,
  });
}

export function useCreateSpell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSpellInput) => spellsApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [SPELLS_KEY] }),
  });
}

export function useUpdateSpell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ spellId, input }: { spellId: string; input: UpdateSpellInput }) =>
      spellsApi.update(spellId, input),
    onSuccess: (_data, { spellId }) => {
      qc.invalidateQueries({ queryKey: [SPELLS_KEY] });
      qc.invalidateQueries({ queryKey: [SPELLS_KEY, spellId] });
    },
  });
}

export function useDeleteSpell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (spellId: string) => spellsApi.delete(spellId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [SPELLS_KEY] }),
  });
}
