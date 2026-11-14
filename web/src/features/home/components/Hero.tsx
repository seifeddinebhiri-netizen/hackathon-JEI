import { ButtonLink, Perforations, PhotoFrame } from '@/components/ui';
import { AiLabel } from '@/features/passport/components/AiLabel';
import type { DepartmentDeclaration } from '@/api/types';
import { brand, sloganSegments } from '@/app/brand';
import { Fragment } from 'react';

const HERO_LABEL: DepartmentDeclaration[] = [
  { department: 'scenario', used_ai: false, what: '', human_decisions: '' },
  { department: 'image', used_ai: false, what: '', human_decisions: '' },
  { department: 'montage', used_ai: true, what: '', level: 'assistance', human_decisions: '' },
  { department: 'son_voix', used_ai: true, what: '', level: 'assistance', human_decisions: '' },
  { department: 'musique', used_ai: false, what: '', human_decisions: '' },
  { department: 'vfx', used_ai: false, what: '', human_decisions: '' },
  { department: 'sous_titres', used_ai: true, what: '', level: 'generation_partielle', human_decisions: '' },
  { department: 'affiche_promo', used_ai: false, what: '', human_decisions: '' },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink text-paper">
      <div className="container-pp grid grid-cols-1 gap-12 pt-14 pb-16 md:pt-20 md:pb-24 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <p className="eyebrow text-gold">{brand.audience}</p>
          <h1 className="mt-5 text-[54px] leading-[0.92] sm:text-[80px] xl:text-hero">
            {brand.sloganLines.map((line, i) => (
              <Fragment key={line}>
                {i > 0 ? <br /> : null}
                {sloganSegments(line).map((seg) =>
                  seg.accent ? (
                    <span key={seg.text} className="text-brand-red">
                      {seg.text}
                    </span>
                  ) : (
                    seg.text
                  ),
                )}
              </Fragment>
            ))}
          </h1>
          <p className="mt-8 max-w-xl text-lead text-muted-on-dark">
            {brand.name} t’accompagne de l’organisation du tournage jusqu’au festival. Sans faire le travail
            créatif à ta place, et en rendant visible ce qui est humain et ce qui est IA.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/connexion" size="lg" iconRight="arrowRight">
              Commencer mon projet
            </ButtonLink>
            <ButtonLink to="/verifier/exemple" variant="on-dark" size="lg">
              Voir un Passeport IA
            </ButtonLink>
          </div>
        </div>

        <div className="relative lg:col-span-5">
          <PhotoFrame photo="hero" priority onDark sizes="(min-width: 1024px) 40vw, 100vw" />
          <div className="relative z-10 -mt-24 ml-auto w-[min(300px,85%)] rotate-[3deg] shadow-hard-gold sm:-mt-32 lg:-mr-6">
            <AiLabel
              filmTitle="Marée basse"
              director="Yassine"
              badgeCode="PP-7K3Q-2M"
              declarations={HERO_LABEL}
              compact
            />
          </div>
        </div>
      </div>
      <Perforations />
    </section>
  );
}
