import { Icon, type IconName } from '@/components/ui';

const ITEMS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'sparkle',
    title: 'L’IA propose, tu décides',
    text: 'Toute proposition est un « Brouillon IA » modifiable.',
  },
  { icon: 'cloud', title: 'Météo honnête', text: 'Au-delà de 14 jours, on écrit « Météo à revérifier ».' },
  {
    icon: 'edit',
    title: 'Ton texte reste le tien',
    text: 'Le synopsis n’est jamais réécrit : on te pose des questions.',
  },
  {
    icon: 'shield',
    title: 'Déclarer sans juger',
    text: '« Non divulgué » décrit l’outil, pas toi. Ce n’est pas un avis juridique.',
  },
  { icon: 'film', title: 'Pas de promesse', text: 'Le classement des festivals ne prédit pas la sélection.' },
  { icon: 'lock', title: 'Tes données', text: 'Exporte ou supprime ton projet quand tu veux.' },
];

/** Éthique 360 en bande compacte. */
export function EthicsBand() {
  return (
    <section
      id="ethique"
      aria-labelledby="ethique-titre"
      className="scroll-mt-4 border-y-2 border-ink bg-white"
    >
      <div className="container-pp py-14 md:py-16">
        <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
          <h2 id="ethique-titre" className="text-h2">
            Éthique 360, en clair
          </h2>
          <p className="text-meta text-muted-on-light">Six engagements visibles dans l’application.</p>
        </div>
        <ul className="mt-8 grid grid-cols-1 gap-px border-2 border-ink bg-ink sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((it) => (
            <li key={it.title} className="flex gap-3 bg-white p-5">
              <Icon name={it.icon} size={22} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{it.title}</p>
                <p className="mt-1 text-meta text-muted-on-light">{it.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
