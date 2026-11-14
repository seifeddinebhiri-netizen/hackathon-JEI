import { useState } from 'react';
import { useNavigate } from 'react-router';
import { usingMocks } from '@/api';
import { resetMockDb } from '@/api/mocks/db';
import { brand } from '@/app/brand';
import {
  Button,
  Dialog,
  DialogContent,
  ErrorState,
  Field,
  Icon,
  Input,
  LoadingBlock,
  PageHeader,
  useToast,
  type IconName,
} from '@/components/ui';
import { useDeleteProjectData, useExportData } from '@/features/account/hooks/useAccount';
import { useCurrentProject } from '@/features/project/hooks/useProject';
import { downloadBlob } from '@/lib/print';

const STORED: { icon: IconName; what: string; where: string; visible: string }[] = [
  {
    icon: 'film',
    what: 'Ton projet : titre, période, scènes, lieux, personnes, planning, sélection de festivals, synopsis, page film',
    where: 'Serveur',
    visible: 'Toi seulement (la page film est publique si tu partages son lien)',
  },
  {
    icon: 'shield',
    what: 'Ton Passeport IA',
    where: 'Serveur',
    visible: 'Public via la page de vérification',
  },
  { icon: 'doc', what: 'Tes sous-titres', where: 'Serveur', visible: 'Toi seulement' },
  { icon: 'lock', what: 'Ta session de connexion', where: 'Ce navigateur', visible: 'Toi seulement' },
  {
    icon: 'layers',
    what: 'Une copie de secours du Kit Festival (profil, synopsis, page film)',
    where: 'Ce navigateur',
    visible: 'Toi seulement',
  },
];

const NOT_STORED: { icon: IconName; text: string }[] = [
  { icon: 'doc', text: 'Ton scénario importé : il est découpé en scènes puis n’est pas conservé.' },
  {
    icon: 'phone',
    text: 'Les images du Coach : elles seront traitées sur ton téléphone et jamais envoyées.',
  },
  { icon: 'sparkle', text: 'Rien de ce que tu écris ne sert à entraîner une IA.' },
  { icon: 'eye', text: 'Pas de publicité ni de traceur publicitaire.' },
];

export default function MyData() {
  const project = useCurrentProject();
  const exp = useExportData();
  const del = useDeleteProjectData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');

  const doExport = (id: string, title: string) =>
    exp.mutate(id, {
      onSuccess: (data) => {
        const slug = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\W+/g, '-');
        downloadBlob(
          new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
          `${brand.slug}-${slug}.json`,
        );
        toast({
          tone: 'ok',
          title: 'Export téléchargé',
          description: 'Un fichier JSON avec tout ton projet.',
        });
      },
      onError: (e) => toast({ tone: 'bad', title: 'Export impossible', description: e.message }),
    });

  const doDelete = (id: string) =>
    del.mutate(id, {
      onSuccess: () => {
        setOpen(false);
        toast({ tone: 'ok', title: 'Projet supprimé', description: 'Ses données ont été effacées.' });
        navigate('/projet');
      },
      onError: (e) => toast({ tone: 'bad', title: 'Suppression impossible', description: e.message }),
    });

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Compte"
        title="Mes données"
        lead="Ce qui est enregistré, ce qui ne l’est pas, et comment tout récupérer ou tout effacer."
      />

      <section aria-labelledby="stocke">
        <h2 id="stocke" className="text-h2">
          Ce qui est enregistré
        </h2>
        <div
          className="mt-4 overflow-x-auto border-2 border-ink bg-white"
          role="region"
          aria-label="Tableau des données enregistrées"
          tabIndex={0}
        >
          <table className="w-full min-w-[560px] text-left">
            <thead className="border-b-2 border-ink bg-paper">
              <tr>
                <th scope="col" className="eyebrow p-3">
                  Donnée
                </th>
                <th scope="col" className="eyebrow p-3">
                  Où
                </th>
                <th scope="col" className="eyebrow p-3">
                  Qui la voit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {STORED.map((r) => (
                <tr key={r.what}>
                  <td className="p-3">
                    <span className="flex items-start gap-2">
                      <Icon name={r.icon} size={18} className="mt-0.5 shrink-0" /> {r.what}
                    </span>
                  </td>
                  <td className="p-3 text-meta">{r.where}</td>
                  <td className="p-3 text-meta">{r.visible}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {usingMocks ? (
          <p className="mt-3 flex items-start gap-2 text-meta text-muted-on-light">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            Version de démonstration : le « serveur » est simulé dans ce navigateur. Rien ne quitte ton
            ordinateur.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="pas-stocke">
        <h2 id="pas-stocke" className="text-h2">
          Ce qui n’est pas enregistré
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-px border-2 border-ink bg-ink md:grid-cols-2">
          {NOT_STORED.map((r) => (
            <li key={r.text} className="flex items-start gap-3 bg-white p-4">
              <Icon name={r.icon} size={20} className="mt-0.5 shrink-0" />
              {r.text}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="actions" className="flex flex-col gap-4">
        <h2 id="actions" className="text-h2">
          Récupérer ou effacer
        </h2>
        {project.isPending ? (
          <LoadingBlock lines={2} />
        ) : project.isError ? (
          <ErrorState
            title="Aucun projet ouvert"
            error={project.error}
            onRetry={() => void project.refetch()}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col items-start gap-3 border-2 border-ink bg-white p-5">
              <p className="font-display text-h3 font-bold">Exporter mes données</p>
              <p className="text-muted-on-light">
                Un fichier JSON avec « {project.data.title} » : projet, planning, Passeport IA, sous-titres.
              </p>
              <Button
                icon="download"
                loading={exp.isPending}
                onClick={() => doExport(project.data.id, project.data.title)}
              >
                Exporter (JSON)
              </Button>
            </div>
            <div className="flex flex-col items-start gap-3 border-2 border-bad-fg bg-bad-bg/40 p-5">
              <p className="font-display text-h3 font-bold">Supprimer mon projet</p>
              <p>
                Efface « {project.data.title} », son planning, son Passeport IA (la page de vérification ne
                fonctionnera plus) et ses sous-titres. Exporte-le d’abord si tu veux le garder.
              </p>
              <Button variant="secondary" icon="trash" onClick={() => setOpen(true)}>
                Supprimer mon projet
              </Button>
            </div>
          </div>
        )}
        {usingMocks ? (
          <div className="flex flex-col items-start gap-2 border-2 border-dashed border-ink/40 p-4">
            <p className="font-semibold">Démonstration</p>
            <p className="text-meta text-muted-on-light">
              Remet le projet « Marée basse » et l’exemple de Passeport dans leur état de départ.
            </p>
            <Button
              variant="ghost"
              size="sm"
              icon="arrowLeft"
              onClick={() => {
                resetMockDb();
                window.location.assign('/projet');
              }}
            >
              Réinitialiser la démo
            </Button>
          </div>
        ) : null}
      </section>

      {project.data ? (
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setConfirm('');
          }}
        >
          <DialogContent
            title="Supprimer définitivement ce projet ?"
            description="Cette action ne peut pas être annulée. Le lien de vérification du Passeport IA cessera de fonctionner."
          >
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (confirm.trim() === project.data.title) doDelete(project.data.id);
              }}
            >
              <Field label={`Pour confirmer, écris le titre du film : « ${project.data.title} »`}>
                <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
              </Field>
              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  icon="trash"
                  loading={del.isPending}
                  disabled={confirm.trim() !== project.data.title}
                >
                  Supprimer définitivement
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
