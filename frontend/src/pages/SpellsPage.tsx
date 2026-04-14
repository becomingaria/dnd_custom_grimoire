import { useState } from "react"
import { useSpells, useCreateSpell } from "@/hooks/useSpells"
import SpellList from "@/components/spells/SpellList"
import Drawer from "@/components/shared/Drawer"
import SpellForm from "@/components/spells/SpellForm"
import type { CreateSpellInput } from "@/types/spell"

export default function SpellsPage() {
    const [showCreate, setShowCreate] = useState(false)

    const { data: spells = [], isLoading } = useSpells()
    const createSpell = useCreateSpell()

    const existingSources = Array.from(
        new Set(spells.map((s) => s.source).filter(Boolean)),
    ).sort()

    async function handleCreate(data: CreateSpellInput) {
        await createSpell.mutateAsync(data)
        setShowCreate(false)
    }

    return (
        <>
            <SpellList
                spells={spells}
                isLoading={isLoading}
                onCreateSpell={() => setShowCreate(true)}
            />

            <Drawer
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                title='New Spell'
            >
                <SpellForm
                    onSubmit={handleCreate}
                    onCancel={() => setShowCreate(false)}
                    isLoading={createSpell.isPending}
                    existingSources={existingSources}
                />
            </Drawer>
        </>
    )
}
