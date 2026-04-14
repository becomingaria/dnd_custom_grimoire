import { useState } from 'react';
import { useSpells, useCreateSpell } from '@/hooks/useSpells';
import SpellList from '@/components/spells/SpellList';
import Modal from '@/components/shared/Modal';
import SpellForm from '@/components/spells/SpellForm';
import type { CreateSpellInput } from '@/types/spell';
import type { SpellFilters } from '@/hooks/useSpells';

export default function SpellsPage() {
  const [filters, setFilters] = useState<SpellFilters>({});
  const [showCreate, setShowCreate] = useState(false);

  const { data: spells = [], isLoading } = useSpells(filters);
  const createSpell = useCreateSpell();

  async function handleCreate(data: CreateSpellInput) {
    await createSpell.mutateAsync(data);
    setShowCreate(false);
  }

  return (
    <>
      <SpellList
        spells={spells}
        isLoading={isLoading}
        filters={filters}
        onFiltersChange={setFilters}
        onNew={() => setShowCreate(true)}
      />

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Spell"
      >
        <SpellForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          isSaving={createSpell.isPending}
        />
      </Modal>
    </>
  );
}
