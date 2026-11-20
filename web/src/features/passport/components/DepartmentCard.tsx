import type { AiTool, Department, DepartmentDeclaration, UsageLevel } from '@/api/types';
import { Button, Field, Icon, Input, SegmentedControl, Select, TextArea } from '@/components/ui';
import { useFindTool } from '../hooks/usePassport';
import { DEPARTMENT_HINTS, DEPARTMENT_LABELS, USAGE_HINTS, USAGE_LABELS } from '../lib/labels';
import { ToolInfo } from './ToolStatus';

const OTHER = '__autre__';
const LEVELS = (Object.keys(USAGE_LABELS) as UsageLevel[]).map((v) => ({ value: v, label: USAGE_LABELS[v] }));

/** Une carte = une question : « As-tu utilisé une IA ? » pour un département. */
export function DepartmentCard({
  department,
  index,
  declaration,
  tools,
  onChange,
}: {
  department: Department;
  index: number;
  declaration: DepartmentDeclaration | undefined;
  tools: AiTool[];
  onChange: (d: DepartmentDeclaration) => void;
}) {
  const d: DepartmentDeclaration = declaration ?? {
    department,
    used_ai: false,
    what: '',
    human_decisions: '',
  };
  const set = (patch: Partial<DepartmentDeclaration>) => onChange({ ...d, ...patch });
  const find = useFindTool();
  const tool = tools.find((t) => t.id === d.tool_id);
  const toolValue = d.tool_id ?? (d.custom_tool !== undefined ? OTHER : '');

  return (
    <section
      aria-labelledby={`dep-${department}`}
      className="flex flex-col gap-6 border-2 border-ink bg-white p-5 md:p-8"
    >
      <header>
        <p className="eyebrow text-muted-on-light">Département {index + 1} sur 8</p>
        <h2 id={`dep-${department}`} className="mt-2 text-h2">
          {DEPARTMENT_LABELS[department]}
        </h2>
        <p className="mt-1 text-muted-on-light">{DEPARTMENT_HINTS[department]}</p>
      </header>

      <SegmentedControl
        legend={<span className="text-body">As-tu utilisé une IA ?</span>}
        value={declaration ? (d.used_ai ? 'oui' : 'non') : undefined}
        onChange={(v) =>
          v === 'non'
            ? onChange({ department, used_ai: false, what: '', human_decisions: d.human_decisions })
            : set({ used_ai: true })
        }
        options={[
          { value: 'non', label: 'Non', icon: 'user' },
          { value: 'oui', label: 'Oui', icon: 'sparkle' },
        ]}
      />

      {declaration && !d.used_ai ? (
        <Field
          label="Qui a fait ce travail ?"
          optional
          hint="Ex. « Écrit par la réalisatrice », « Musique de [compositeur] »."
        >
          <Input value={d.human_decisions} onChange={(e) => set({ human_decisions: e.target.value })} />
        </Field>
      ) : null}

      {d.used_ai ? (
        <>
          <div className="flex flex-col gap-3">
            <Field label="Quel outil ?" required>
              <Select
                value={toolValue}
                onChange={(e) =>
                  e.target.value === OTHER
                    ? set({ tool_id: undefined, custom_tool: d.custom_tool ?? '' })
                    : set({ tool_id: e.target.value || undefined, custom_tool: undefined })
                }
              >
                <option value="" disabled>
                  Choisir dans le catalogue…
                </option>
                {tools.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.provider}
                  </option>
                ))}
                <option value={OTHER}>Autre outil (saisir le nom)</option>
              </Select>
            </Field>
            {toolValue === OTHER ? (
              <div className="flex flex-col gap-3">
                <Field
                  label="Nom de l’outil"
                  hint="Absent de la liste ? Nous cherchons sa documentation publique sur le site du fournisseur (10 à 60 secondes). Sans résultat vérifiable, il est déclaré « hors catalogue »."
                >
                  <Input value={d.custom_tool ?? ''} onChange={(e) => set({ custom_tool: e.target.value })} />
                </Field>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={find.isPending}
                    disabled={(d.custom_tool ?? '').trim().length < 2}
                    onClick={() =>
                      find.mutate((d.custom_tool ?? '').trim(), {
                        onSuccess: (found) => set({ tool_id: found.id, custom_tool: undefined }),
                      })
                    }
                  >
                    Chercher cet outil
                  </Button>
                  {find.isPending ? (
                    <p role="status" className="text-meta text-muted-on-light">
                      Recherche en cours… tu peux continuer à remplir cette page.
                    </p>
                  ) : null}
                </div>
                {find.isError ? (
                  <p role="alert" className="flex items-start gap-1.5 text-meta font-semibold text-warn-fg">
                    <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                    {find.error.message} L’outil reste déclaré « hors catalogue » : ce n’est pas un reproche,
                    nous n’avons simplement pas de source à citer.
                  </p>
                ) : null}
              </div>
            ) : null}
            {tool ? <ToolInfo tool={tool} /> : null}
          </div>

          <Field label="Qu’est-ce que l’IA a fait ?" required>
            <TextArea
              rows={2}
              value={d.what}
              onChange={(e) => set({ what: e.target.value })}
              placeholder="Ex. réduction du bruit sur deux scènes extérieures."
            />
          </Field>

          <div className="flex flex-col gap-2">
            <SegmentedControl
              legend="Niveau d’usage"
              value={d.level}
              onChange={(v) => set({ level: v })}
              options={LEVELS}
            />
            <p className="flex items-start gap-1.5 text-meta text-muted-on-light">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              {d.level ? USAGE_HINTS[d.level] : 'Assistance : l’IA a aidé, l’humain a créé.'}
            </p>
          </div>

          <Field
            label="Ce que j’ai décidé moi-même"
            hint="Ce qui reste ton choix : sélection, réécriture, validation…"
          >
            <TextArea
              rows={2}
              value={d.human_decisions}
              onChange={(e) => set({ human_decisions: e.target.value })}
            />
          </Field>
        </>
      ) : null}
    </section>
  );
}
