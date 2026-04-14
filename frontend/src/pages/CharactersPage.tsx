import { useState } from 'react';
import { useCharacters, useCreateCharacter } from '@/hooks/useCharacters';
import CharacterList from '@/components/characters/CharacterList';
import Modal from '@/components/shared/Modal';
import CharacterForm from '@/components/characters/CharacterForm';
import type { CreateCharacterInput } from '@/types/character';

export default function CharactersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: characters = [], isLoading } = useCharacters();
  const createCharacter = useCreateCharacter();

  async function handleCreate(data: CreateCharacterInput) {
    await createCharacter.mutateAsync(data);
    setShowCreate(false);
  }

  return (
    <>
      <CharacterList
        characters={characters}
        isLoading={isLoading}
        onNew={() => setShowCreate(true)}
      />

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Character"
      >
        <CharacterForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          isSaving={createCharacter.isPending}
        />
      </Modal>
    </>
  );
}
