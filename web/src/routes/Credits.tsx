import { PageHeader, PhotoFrame } from '@/components/ui';
import { PHOTOS } from '@/lib/photos';

export default function Credits() {
  return (
    <div className="container-pp py-12 md:py-16">
      <PageHeader
        eyebrow="Crédits"
        title="Crédits photo"
        lead="Toutes les photos viennent d’Unsplash et sont utilisées sous la licence Unsplash. Merci à leurs auteurs."
      />
      <ul className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(PHOTOS).map(([key, p]) => (
          <li key={key}>
            <PhotoFrame photo={p} ratio="3:2" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" />
            <p className="mt-3 font-semibold">
              <a href={p.authorUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">
                {p.author}
              </a>
            </p>
            <p className="text-meta text-muted-on-light">{p.alt}</p>
            <p className="text-meta text-muted-on-light">Utilisée : {p.usage}</p>
            <a
              href={p.photoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center text-meta font-semibold underline underline-offset-4"
            >
              Voir sur Unsplash<span className="sr-only"> (nouvel onglet)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-12 max-w-prose text-meta text-muted-on-light">
        Les photos sont affichées avec un léger traitement de couleur (contraste renforcé, saturation réduite) appliqué
        par le navigateur. Les fichiers d’origine ne sont pas modifiés, à part leur taille.
      </p>
    </div>
  );
}
