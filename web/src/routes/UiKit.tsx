/**
 * Page interne /_ui : tous les composants et leurs états.
 * Chargée uniquement en développement (exclue du build de production, voir app/router.tsx).
 */
import { useState, type ReactNode } from 'react';
import {
  AiDraftBadge,
  Button,
  Card,
  CharCount,
  Checkbox,
  Countdown,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  EmptyState,
  ErrorState,
  Eyebrow,
  Field,
  FileDrop,
  Icon,
  Input,
  LoadingBlock,
  PageHeader,
  Perforations,
  PhotoFrame,
  ScoreSquares,
  Select,
  Skeleton,
  StatusChip,
  Stepper,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
  Tooltip,
  useToast,
} from '@/components/ui';
import { demoDate } from '@/api/mocks/weather';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t-2 border-ink py-10">
      <h2 className="mb-6 text-h2">{title}</h2>
      {children}
    </section>
  );
}

const COLORS: { name: string; cls: string; hex: string; dark?: boolean }[] = [
  { name: 'ink', cls: 'bg-ink', hex: '#121110', dark: true },
  { name: 'paper', cls: 'bg-paper', hex: '#F2F2EF' },
  { name: 'surface-dark', cls: 'bg-surface-dark', hex: '#1F1D1B', dark: true },
  { name: 'line-dark', cls: 'bg-line-dark', hex: '#3A3733', dark: true },
  { name: 'line-light', cls: 'bg-line-light', hex: '#D9D7D1' },
  { name: 'muted-on-dark', cls: 'bg-muted-on-dark', hex: '#B8B4AC' },
  { name: 'muted-on-light', cls: 'bg-muted-on-light', hex: '#55524C', dark: true },
  { name: 'brand-red', cls: 'bg-brand-red', hex: '#E4202E', dark: true },
  { name: 'action', cls: 'bg-action', hex: '#C8102E', dark: true },
  { name: 'gold', cls: 'bg-gold', hex: '#FFC82E' },
  { name: 'ext (calendrier)', cls: 'bg-ext', hex: '#FFE7A3' },
  { name: 'int (calendrier)', cls: 'bg-int', hex: '#E2E0D9' },
];

export default function UiKit() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [checked, setChecked] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('Une jeune femme tente de sauver le café de son oncle.');

  return (
    <div className="container-pp py-12">
      <PageHeader
        eyebrow="Interne · non publié"
        title="Kit UI « Noir pellicule »"
        lead="Tous les composants et leurs états : défaut, survol, focus (Tab), désactivé, chargement."
      />

      <Section title="Couleurs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {COLORS.map((c) => (
            <div key={c.name} className="border-2 border-ink">
              <div className={`h-16 ${c.cls}`} />
              <div className="bg-white p-2">
                <p className="eyebrow">{c.name}</p>
                <p className="text-meta text-muted-on-light">{c.hex}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <StatusChip tone="ok">Documenté / OK</StatusChip>
          <StatusChip tone="warn">Partiel / attention</StatusChip>
          <StatusChip tone="bad">Non divulgué / conflit</StatusChip>
        </div>
      </Section>

      <Section title="Typographie">
        <p className="font-display text-[56px] leading-[0.92] font-bold tracking-tight md:text-hero">
          Fais-toi <span className="text-brand-red">voir.</span>
        </p>
        <h1 className="mt-6 text-page">Titre de page 56 px</h1>
        <h2 className="mt-4 text-h2">Titre de section 32 px</h2>
        <h3 className="mt-4 text-h3">Sous-titre 22 px</h3>
        <p className="mt-4 text-lead">Texte d’introduction 18 px, Inter.</p>
        <p className="mt-2">Texte courant 16 px, Inter 400.</p>
        <p className="mt-2 text-meta text-muted-on-light">Texte secondaire 13 px minimum.</p>
        <Eyebrow className="mt-2">Étiquette JetBrains Mono 12 px</Eyebrow>
      </Section>

      <Section title="Button">
        <div className="flex flex-col gap-4">
          {(['primary', 'secondary', 'ghost'] as const).map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-3">
              <Eyebrow className="w-24">{v}</Eyebrow>
              <Button variant={v}>Par défaut</Button>
              <Button variant={v} icon="calendar">
                Avec icône
              </Button>
              <Button variant={v} disabled>
                Désactivé
              </Button>
              <Button variant={v} loading>
                Chargement
              </Button>
              <Button variant={v} size="sm">
                Petit
              </Button>
              <Button variant={v} size="lg" iconRight="arrowRight">
                Grand
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 bg-ink p-4">
            <Eyebrow className="w-24 text-paper">on-dark</Eyebrow>
            <Button variant="on-dark">Par défaut</Button>
            <Button variant="on-dark" disabled>
              Désactivé
            </Button>
            <Button variant="on-dark" loading>
              Chargement
            </Button>
            <Button>Primaire sur noir</Button>
          </div>
        </div>
      </Section>

      <Section title="StatusChip · AiDraftBadge · ScoreSquares · Countdown">
        <div className="flex flex-wrap gap-3">
          <StatusChip tone="ok">Prêt</StatusChip>
          <StatusChip tone="warn">À préparer</StatusChip>
          <StatusChip tone="bad">Pluie prévue</StatusChip>
          <StatusChip tone="neutral" icon="sun">
            Jour
          </StatusChip>
          <StatusChip tone="gold" icon="golden">
            Heure dorée
          </StatusChip>
          <StatusChip tone="dark" icon="moon">
            Nuit
          </StatusChip>
          <StatusChip tone="red" icon="check">
            Soumis
          </StatusChip>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <AiDraftBadge />
          <AiDraftBadge validated />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {([1, 2, 3, 4, 5] as const).map((s) => (
            <ScoreSquares key={s} score={s} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Countdown date={demoDate(40)} />
          <Countdown date={demoDate(9)} />
          <Countdown date={demoDate(1)} />
          <Countdown date={demoDate(0)} />
          <Countdown date={demoDate(-3)} />
        </div>
      </Section>

      <Section title="Stepper">
        <Stepper
          current={step}
          onSelect={setStep}
          steps={[
            { id: 'projet', label: 'Projet', done: step > 0 },
            { id: 'scenario', label: 'Scénario', done: step > 1 },
            { id: 'lieux', label: 'Lieux', done: step > 2 },
            { id: 'personnes', label: 'Personnes', done: step > 3 },
            { id: 'generer', label: 'Générer' },
          ]}
        />
      </Section>

      <Section title="Formulaires : Field, Input, TextArea, Select, Checkbox">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Titre du film" hint="Tu pourras le changer plus tard." required>
            <Input placeholder="Marée basse" />
          </Field>
          <Field label="Ville" error="Indique une ville ou une adresse.">
            <Input defaultValue="" placeholder="Tunis" />
          </Field>
          <Field label="Champ désactivé">
            <Input disabled defaultValue="Non modifiable" />
          </Field>
          <Field label="Moment voulu">
            <Select defaultValue="jour">
              <option value="jour">Jour</option>
              <option value="nuit">Nuit</option>
              <option value="aube">Aube</option>
              <option value="heure_doree">Heure dorée</option>
            </Select>
          </Field>
          <Field label="Synopsis court" optional className="md:col-span-2">
            <TextArea value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <CharCount value={text} limit={60} />
          <div>
            <Checkbox checked={checked} onCheckedChange={setChecked} label="Sous-titres validés" hint="Coche quand c’est fait." />
            <Checkbox checked={false} onCheckedChange={() => {}} label="Désactivé" disabled />
          </div>
        </div>
      </Section>

      <Section title="FileDrop">
        <FileDrop accept={['.pdf', '.docx', '.txt', '.fountain']} maxSizeMb={10} file={file} onFile={setFile} />
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Trouver mon festival</TabsTrigger>
            <TabsTrigger value="b">Ma sélection</TabsTrigger>
            <TabsTrigger value="c">Sous-titres</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Contenu de l’onglet A.</TabsContent>
          <TabsContent value="b">Contenu de l’onglet B.</TabsContent>
          <TabsContent value="c">Contenu de l’onglet C.</TabsContent>
        </Tabs>
      </Section>

      <Section title="Card">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>Clair</Card>
          <Card raised>Mise en avant (ombre décalée)</Card>
          <Card tone="dark">Sombre</Card>
          <Card tone="gold">Or</Card>
        </div>
      </Section>

      <Section title="États : chargement, vide, erreur">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <LoadingBlock />
            <Skeleton className="mt-4 h-24 w-full" />
          </div>
          <EmptyState title="Aucune scène pour l’instant" action={<Button icon="plus">Ajouter une scène</Button>}>
            Importe ton scénario ou saisis tes scènes à la main.
          </EmptyState>
          <ErrorState error="Impossible de joindre le serveur. Vérifie ta connexion." onRetry={() => {}} />
        </div>
      </Section>

      <Section title="Dialog · Toast · Tooltip">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Ouvrir un dialog</Button>
            </DialogTrigger>
            <DialogContent title="Supprimer mon projet ?" description="Cette action est définitive.">
              <div className="flex justify-end gap-3">
                <DialogClose asChild>
                  <Button variant="ghost">Annuler</Button>
                </DialogClose>
                <Button icon="trash">Supprimer</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="secondary" onClick={() => toast({ title: 'Planning enregistré', tone: 'ok' })}>
            Toast OK
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ title: 'Échec de l’enregistrement', description: 'Réessaie.', tone: 'bad' })}
          >
            Toast erreur
          </Button>
          <Tooltip content="Le statut décrit ce que publie le fournisseur de l’outil.">
            <Button variant="ghost" icon="info">
              Infobulle
            </Button>
          </Tooltip>
        </div>
      </Section>

      <Section title="Perforations · PhotoFrame">
        <Perforations />
        <Perforations tone="gold" className="mt-2" />
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <PhotoFrame photo="hero" />
          <PhotoFrame photo="drapeaux" ratio="2.39:1" tilt />
          <PhotoFrame alt="Emplacement sans photo" ratio="4:5" />
        </div>
      </Section>

      <Section title="Icônes">
        <p className="text-meta text-muted-on-light">Toujours accompagnées d’un libellé texte.</p>
        <div className="mt-4 flex flex-wrap gap-4">
          {(['sun', 'moon', 'sunrise', 'golden', 'rain', 'wind', 'pin', 'clock', 'shield', 'alert', 'check', 'film'] as const).map(
            (n) => (
              <span key={n} className="inline-flex items-center gap-1.5 text-meta">
                <Icon name={n} /> {n}
              </span>
            ),
          )}
        </div>
      </Section>
    </div>
  );
}
