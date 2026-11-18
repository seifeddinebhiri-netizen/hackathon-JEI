import { QRCodeSVG } from 'qrcode.react';
import { Button, Icon, PageHeader, useToast } from '@/components/ui';
import { CoachFlow } from '@/features/coach/plan/components/CoachFlow';
import { env } from '@/lib/env';
import { copyToClipboard } from '@/lib/print';
import { useMediaQuery } from '@/lib/useMediaQuery';

function PrivacyNote() {
  return (
    <p className="flex items-start gap-2 border-2 border-ink bg-gold-soft p-4">
      <Icon name="lock" size={20} className="mt-0.5 shrink-0" />
      <span>
        <strong>Confidentialité :</strong> les images de la caméra sont analysées sur ton téléphone, rien
        n’est envoyé. Le texte de ta scène part vers l’IA (Google Gemini) pour proposer le plan. Quand tu es
        connecté, tes espaces de travail (scène, plan, modifications) sont enregistrés sur ton compte pour les
        retrouver sur un autre appareil : toi seul y as accès et tu peux les supprimer.
      </span>
    </p>
  );
}

/** QR code pour ouvrir le Coach sur un téléphone depuis un ordinateur. */
function PhoneQr() {
  const { toast } = useToast();
  const url = `${env.publicAppUrl.replace(/\/$/, '')}/coach`;
  const local = /localhost|127\.0\.0\.1/.test(url);
  return (
    <div className="sticky top-24 flex flex-col items-start gap-5 border-2 border-ink bg-ink p-6 text-paper shadow-hard-gold">
      <p className="eyebrow text-gold">Ouvre-le sur ton téléphone</p>
      <div className="bg-white p-4">
        <QRCodeSVG
          value={url}
          size={180}
          level="M"
          bgColor="#ffffff"
          fgColor="#121110"
          title={`QR code vers ${url}`}
        />
      </div>
      <p className="font-mono text-label break-all text-muted-on-dark">{url}</p>
      <Button
        variant="on-dark"
        icon="copy"
        onClick={() =>
          void copyToClipboard(url).then((ok) =>
            toast(ok ? { tone: 'ok', title: 'Lien copié' } : { tone: 'bad', title: 'Copie impossible' }),
          )
        }
      >
        Copier le lien
      </Button>
      {local ? (
        <p className="text-meta text-muted-on-dark">
          Démo locale : pour scanner depuis un téléphone, mets l’adresse réseau de l’ordinateur dans
          VITE_PUBLIC_APP_URL.
        </p>
      ) : null}
    </div>
  );
}

export default function Coach() {
  const desktop = useMediaQuery('(min-width: 1024px)');
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Étape 2 · Tourner"
        title="Le Coach"
        lead="Décris ta scène : l’IA propose un plan en mots que tu peux modifier, puis la caméra de ton téléphone te guide pendant la prise."
      />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <CoachFlow />
        </div>
        {desktop ? (
          <aside className="lg:col-span-4">
            <PhoneQr />
          </aside>
        ) : null}
      </div>
      <PrivacyNote />
    </div>
  );
}
