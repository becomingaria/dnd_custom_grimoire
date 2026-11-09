import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, ExternalLink, Pencil } from "lucide-react"
import Drawer from "@/components/shared/Drawer"
import LoadingSpinner from "@/components/shared/LoadingSpinner"
import SpellForm from "@/components/spells/SpellForm"
import { useSpells, useUpdateSpell } from "@/hooks/useSpells"
import type { CreateSpellInput, Spell } from "@/types/spell"
import {
    SOURCES,
    SRD_ATTRIBUTION_NOTICE,
    validateSpell,
    type SourceKind,
    type SpellIssue,
} from "@shared/spell-standard"

const KIND_LABEL: Record<SourceKind, string> = {
    srd: "Open licence",
    official: "Official",
    "third-party": "Third-party",
    original: "Grimoire original",
    homebrew: "Community",
}

interface AuditRow {
    spell: Spell
    errors: SpellIssue[]
    attribution: SpellIssue[]
    style: SpellIssue[]
}

export default function SpellAttributionAudit() {
    const { data: spells = [], isLoading } = useSpells()
    const updateSpell = useUpdateSpell()
    const [editing, setEditing] = useState<Spell | null>(null)

    const { rows, sourceCounts, unregistered } = useMemo(() => {
        const sourceCounts = new Map<string, number>()
        const unregistered = new Map<string, number>()
        const rows: AuditRow[] = []

        for (const spell of spells) {
            for (const s of spell.sources ?? []) {
                sourceCounts.set(s, (sourceCounts.get(s) ?? 0) + 1)
                if (!SOURCES[s]) unregistered.set(s, (unregistered.get(s) ?? 0) + 1)
            }
            const issues = validateSpell({
                ...spell,
                sources: spell.sources ?? [],
            })
            const errors = issues.filter((i) => i.severity === "error")
            const warnings = issues.filter((i) => i.severity === "warning")
            // Missing book details are reported once per source in the table
            // above, not once per spell.
            const attribution = warnings.filter(
                (i) =>
                    i.field === "attribution" &&
                    !(spell.sources ?? []).some((s) => SOURCES[s]?.needsInfo),
            )
            const style = warnings.filter((i) => i.field !== "attribution")
            if (errors.length || attribution.length || style.length)
                rows.push({ spell, errors, attribution, style })
        }
        rows.sort(
            (a, b) =>
                b.errors.length - a.errors.length ||
                b.attribution.length - a.attribution.length ||
                a.spell.name.localeCompare(b.spell.name),
        )
        return { rows, sourceCounts, unregistered }
    }, [spells])

    const needsAction = rows.filter(
        (r) => r.errors.length || r.attribution.length,
    )
    const styleOnly = rows.filter(
        (r) => !r.errors.length && !r.attribution.length,
    )

    async function handleSave(input: CreateSpellInput) {
        if (!editing) return
        await updateSpell.mutateAsync({ spellId: editing.spellId, input })
        setEditing(null)
    }

    if (isLoading) {
        return (
            <div className='flex h-40 items-center justify-center'>
                <LoadingSpinner label='Loading spells…' />
            </div>
        )
    }

    return (
        <div className='space-y-8'>
            {/* Source registry */}
            <section className='space-y-3'>
                <SectionHeading
                    title='Source registry'
                    hint='Every spell must cite at least one of these. Add new books in shared/spell-standard.ts.'
                />
                <div className='grimoire-card divide-y divide-grimoire-border/60'>
                    {Object.values(SOURCES).map((src) => (
                        <div
                            key={src.abbr}
                            className='flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-4'
                        >
                            <span className='w-20 shrink-0 font-mono text-xs text-grimoire-primary-light'>
                                {src.abbr}
                            </span>
                            <div className='min-w-0 flex-1'>
                                <p className='font-rajdhani text-sm text-grimoire-text-base'>
                                    {src.url ? (
                                        <a
                                            href={src.url}
                                            target='_blank'
                                            rel='noreferrer'
                                            className='inline-flex items-center gap-1 hover:underline'
                                        >
                                            {src.title}
                                            <ExternalLink size={11} />
                                        </a>
                                    ) : (
                                        src.title
                                    )}
                                </p>
                                <p className='font-rajdhani text-xs text-grimoire-text-faint'>
                                    {src.publisher}
                                    {src.year ? ` · ${src.year}` : ""} ·{" "}
                                    {KIND_LABEL[src.kind]}
                                    {src.license ? ` · ${src.license}` : ""}
                                </p>
                                {src.needsInfo && (
                                    <p className='mt-0.5 flex items-start gap-1 font-rajdhani text-xs text-amber-300'>
                                        <AlertTriangle
                                            size={12}
                                            className='mt-0.5 shrink-0'
                                        />
                                        {src.needsInfo}
                                    </p>
                                )}
                            </div>
                            <span className='font-mono text-xs text-grimoire-text-muted sm:w-20 sm:text-right'>
                                {sourceCounts.get(src.abbr) ?? 0} spells
                            </span>
                        </div>
                    ))}
                </div>
                {unregistered.size > 0 && (
                    <p className='rounded-lg border border-grimoire-danger/30 bg-grimoire-danger/10 px-3 py-2 font-rajdhani text-sm text-grimoire-danger'>
                        Unregistered source labels in use:{" "}
                        {[...unregistered.entries()]
                            .map(([s, n]) => `“${s}” (${n})`)
                            .join(", ")}
                        . Register them or re-attribute those spells.
                    </p>
                )}
            </section>

            {/* Spells needing attention */}
            <section className='space-y-3'>
                <SectionHeading
                    title={`Needs attention (${needsAction.length})`}
                    hint='Spells that break the standard or have no credited author. Editing a spell saves it in house style automatically.'
                />
                {needsAction.length === 0 ? (
                    <p className='flex items-center gap-2 font-rajdhani text-sm text-emerald-400'>
                        <CheckCircle2 size={15} /> Every spell is correctly
                        attributed.
                    </p>
                ) : (
                    <ul className='space-y-2'>
                        {needsAction.map((row) => (
                            <AuditItem
                                key={row.spell.spellId}
                                row={row}
                                onEdit={() => setEditing(row.spell)}
                            />
                        ))}
                    </ul>
                )}
            </section>

            {styleOnly.length > 0 && (
                <section className='space-y-2'>
                    <SectionHeading
                        title={`Style drift (${styleOnly.length})`}
                        hint="Cosmetic only (e.g. “60 ft.” vs “60 feet”). Fixed automatically when edited, or in bulk with npm run fix:spells:db."
                    />
                    <details className='grimoire-card px-4 py-3'>
                        <summary className='cursor-pointer font-rajdhani text-sm text-grimoire-text-muted'>
                            Show spells
                        </summary>
                        <ul className='mt-2 space-y-2'>
                            {styleOnly.map((row) => (
                                <AuditItem
                                    key={row.spell.spellId}
                                    row={row}
                                    onEdit={() => setEditing(row.spell)}
                                />
                            ))}
                        </ul>
                    </details>
                </section>
            )}

            {/* Licence notice */}
            <section className='space-y-2'>
                <SectionHeading
                    title='SRD attribution notice'
                    hint='Required by CC-BY-4.0 wherever SRD 5.1 text is shown. Displayed in the site footer.'
                />
                <p className='grimoire-card px-4 py-3 font-rajdhani text-xs leading-relaxed text-grimoire-text-muted'>
                    {SRD_ATTRIBUTION_NOTICE}
                </p>
            </section>

            <Drawer
                isOpen={!!editing}
                onClose={() => setEditing(null)}
                title={editing ? `Edit ${editing.name}` : ""}
            >
                {editing && (
                    <SpellForm
                        key={editing.spellId}
                        initial={editing}
                        onSubmit={handleSave}
                        onCancel={() => setEditing(null)}
                        isLoading={updateSpell.isPending}
                        isAdmin
                    />
                )}
            </Drawer>
        </div>
    )
}

function SectionHeading({ title, hint }: { title: string; hint: string }) {
    return (
        <div>
            <h3 className='font-cinzel text-sm font-semibold uppercase tracking-widest text-grimoire-text-base'>
                {title}
            </h3>
            <p className='font-rajdhani text-sm text-grimoire-text-faint'>
                {hint}
            </p>
        </div>
    )
}

function AuditItem({ row, onEdit }: { row: AuditRow; onEdit: () => void }) {
    const issues = [...row.errors, ...row.attribution, ...row.style]
    return (
        <li className='flex items-start gap-3 rounded-lg border border-grimoire-border/60 bg-grimoire-surface/40 px-3 py-2'>
            <div className='min-w-0 flex-1'>
                <p className='font-rajdhani text-sm font-semibold text-grimoire-text-base'>
                    {row.spell.name}
                    <span className='ml-2 font-mono text-[11px] font-normal text-grimoire-text-faint'>
                        {(row.spell.sources ?? []).join(", ") || "no source"}
                    </span>
                </p>
                <ul className='mt-0.5 space-y-0.5'>
                    {issues.map((i, idx) => (
                        <li
                            key={idx}
                            className={[
                                "break-words font-rajdhani text-xs",
                                i.severity === "error"
                                    ? "text-grimoire-danger"
                                    : "text-amber-300/90",
                            ].join(" ")}
                        >
                            {i.message}
                        </li>
                    ))}
                </ul>
            </div>
            <button
                type='button'
                onClick={onEdit}
                className='flex shrink-0 items-center gap-1 rounded-lg border border-grimoire-border px-2 py-1 font-rajdhani text-xs text-grimoire-text-muted transition-colors hover:border-grimoire-primary/40 hover:text-grimoire-text-base'
            >
                <Pencil size={12} /> Edit
            </button>
        </li>
    )
}
