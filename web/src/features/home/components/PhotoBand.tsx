import { PhotoFrame } from '@/components/ui';
import type { PhotoKey } from '@/lib/photos';

const SHOTS: { photo: PhotoKey; label: string; text: string }[] = [
  { photo: 'ruelle', label: 'Le décor', text: 'Ta ville, tes ruelles, ta lumière.' },
  {
    photo: 'tournageTelephone',
    label: 'Le matériel',
    text: 'Un téléphone et un stabilisateur suffisent pour commencer.',
  },
  { photo: 'projection', label: 'La destination', text: 'Une salle, un public, un festival.' },
];

/** Bande photo : du décor à la salle, en trois images. */
export function PhotoBand() {
  return (
    <section aria-labelledby="photo-titre" className="bg-ink text-paper">
      <div className="container-pp py-16 md:py-24">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 id="photo-titre" className="max-w-2xl text-[36px] leading-none md:text-[48px]">
            Fait pour les petites équipes, <span className="text-gold">avec peu de moyens.</span>
          </h2>
          <p className="max-w-sm text-muted-on-dark">
            Premier Plan s’occupe de la logistique et de la paperasse. Toi, tu filmes.
          </p>
        </div>
        <ul className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3 md:gap-6">
          {SHOTS.map((s, i) => (
            <li key={s.photo} className={i === 1 ? 'sm:mt-12' : undefined}>
              <PhotoFrame photo={s.photo} ratio="4:5" onDark sizes="(min-width: 640px) 33vw, 100vw" />
              <p className="eyebrow mt-4 text-gold">
                {String(i + 1).padStart(2, '0')} · {s.label}
              </p>
              <p className="mt-1 text-muted-on-dark">{s.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
