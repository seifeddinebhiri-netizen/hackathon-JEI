/**
 * Contrôles du Coach et consignes affichées.
 *
 * Chaque consigne = une maquette (SVG gris, traits fins, fond transparent, dans public/coach/,
 * mise en cache par le service worker) + un texte à trous dont seul le nombre change en direct.
 * Remplacer une maquette par une vraie photo = déposer un fichier du même nom dans public/coach/.
 *
 * Pour l'instant, les valeurs sont SIMULÉES (écran de démonstration) : aucune mesure réelle.
 * `why` est un texte qualitatif de départ ; à relier aux règles (rule_ids) du shot spec réel.
 */

export type CheckId =
  'horizon' | 'angle' | 'size' | 'position' | 'headroom' | 'light' | 'contrast' | 'backlight' | 'steady';

export type Variant = {
  /** Maquette affichée avec la consigne. */
  image: string;
  /** Texte principal ; `n` est la valeur à corriger (ignorée si `unit` est vide). */
  title: (n: number) => string;
  /** Petite aide sous le titre. */
  hint: string;
  /** Réponse à « Pourquoi ? » (qualitatif, sans chiffre). */
  why: string;
  /** Plage des valeurs simulées en démonstration. */
  range: readonly [number, number];
  unit: '°' | '%' | '×' | '';
};

export type CheckDef = {
  id: CheckId;
  /** Libellé court sous le voyant (12 px minimum, donc 8 lettres ou presque). */
  label: string;
  /** Plus petit = plus urgent. Stabilité, puis cadrage, puis exposition. */
  priority: number;
  variants: Record<string, Variant>;
};

const img = (name: string) => `/coach/${name}.svg`;

/** Ordre d'affichage des voyants. */
export const CHECKS: readonly CheckDef[] = [
  {
    id: 'horizon',
    label: 'Horizon',
    priority: 2,
    variants: {
      left: {
        image: img('horizon-left'),
        title: (n) => `Tourne le téléphone de ${n}° vers la gauche`,
        hint: 'L’horizon monte vers la droite.',
        why: 'Un horizon penché attire l’œil et distrait, sauf si c’est un choix (plan penché).',
        range: [2, 15],
        unit: '°',
      },
      right: {
        image: img('horizon-right'),
        title: (n) => `Tourne le téléphone de ${n}° vers la droite`,
        hint: 'L’horizon descend vers la droite.',
        why: 'Un horizon penché attire l’œil et distrait, sauf si c’est un choix (plan penché).',
        range: [2, 15],
        unit: '°',
      },
    },
  },
  {
    id: 'angle',
    label: 'Angle',
    priority: 3,
    variants: {
      up: {
        image: img('angle-up'),
        title: (n) => `Élève de ${n}°`,
        hint: 'Le téléphone pointe trop vers le bas.',
        why: 'L’angle de la caméra change la façon dont on perçoit le sujet. À hauteur d’yeux, le regard reste neutre.',
        range: [2, 20],
        unit: '°',
      },
      down: {
        image: img('angle-down'),
        title: (n) => `Abaisse de ${n}°`,
        hint: 'Le téléphone pointe trop vers le haut.',
        why: 'L’angle de la caméra change la façon dont on perçoit le sujet. À hauteur d’yeux, le regard reste neutre.',
        range: [2, 20],
        unit: '°',
      },
    },
  },
  {
    id: 'size',
    label: 'Taille',
    priority: 4,
    variants: {
      small: {
        image: img('size-small'),
        title: (n) => `Cadre plus serré (+${n} %)`,
        hint: 'Le sujet est trop petit dans l’image.',
        why: 'La taille du sujet dans l’image exprime l’intention du plan : large pour situer, serré pour l’émotion.',
        range: [5, 30],
        unit: '%',
      },
      large: {
        image: img('size-large'),
        title: (n) => `Cadre plus large (−${n} %)`,
        hint: 'Le sujet est trop grand dans l’image.',
        why: 'La taille du sujet dans l’image exprime l’intention du plan : large pour situer, serré pour l’émotion.',
        range: [5, 30],
        unit: '%',
      },
    },
  },
  {
    id: 'position',
    label: 'Position',
    priority: 5,
    variants: {
      left: {
        image: img('position-left'),
        title: (n) => `Place le sujet ${n} % plus à droite`,
        hint: 'Vise une ligne de tiers.',
        why: 'Placer le sujet sur une ligne de tiers donne souvent une image plus équilibrée que le centre.',
        range: [3, 25],
        unit: '%',
      },
      right: {
        image: img('position-right'),
        title: (n) => `Place le sujet ${n} % plus à gauche`,
        hint: 'Vise une ligne de tiers.',
        why: 'Placer le sujet sur une ligne de tiers donne souvent une image plus équilibrée que le centre.',
        range: [3, 25],
        unit: '%',
      },
    },
  },
  {
    id: 'headroom',
    label: 'Tête',
    priority: 6,
    variants: {
      much: {
        image: img('headroom-much'),
        title: (n) => `Baisse le cadre de ${n} %`,
        hint: 'Trop d’espace au-dessus de la tête : incline le téléphone vers le bas.',
        why: 'Trop d’espace au-dessus de la tête écrase le sujet en bas de l’image.',
        range: [3, 20],
        unit: '%',
      },
      little: {
        image: img('headroom-little'),
        title: (n) => `Relève le cadre de ${n} %`,
        hint: 'La tête est trop près du haut : incline le téléphone vers le haut.',
        why: 'Laisser un peu d’espace au-dessus de la tête évite un cadrage étouffant.',
        range: [3, 20],
        unit: '%',
      },
    },
  },
  {
    id: 'light',
    label: 'Lumière',
    priority: 8,
    variants: {
      dark: {
        image: img('light-dark'),
        title: (n) => `Image trop sombre : +${n} %`,
        hint: 'Cherche plus de lumière : fenêtre, lampe ou reflet.',
        why: 'Une image trop sombre perd des détails difficiles à récupérer ensuite.',
        range: [5, 40],
        unit: '%',
      },
      bright: {
        image: img('light-bright'),
        title: (n) => `Image trop claire : −${n} %`,
        hint: 'Évite la lumière directe ou place le sujet à l’ombre.',
        why: 'Une image trop claire perd des détails difficiles à récupérer ensuite.',
        range: [5, 40],
        unit: '%',
      },
    },
  },
  {
    id: 'contrast',
    label: 'Contraste',
    priority: 9,
    variants: {
      low: {
        image: img('contrast-low'),
        title: (n) => `Contraste trop faible : +${n} %`,
        hint: 'Cherche une lumière plus directe ou un fond plus sombre.',
        why: 'Un contraste très faible donne une image plate, où le sujet se détache mal du fond.',
        range: [5, 30],
        unit: '%',
      },
      high: {
        image: img('contrast-high'),
        title: (n) => `Contraste trop fort : −${n} %`,
        hint: 'Adoucis la lumière : ombre ouverte, réflecteur ou voilage.',
        why: 'Un contraste très fort écrase les ombres et brûle les hautes lumières, difficiles à rattraper ensuite.',
        range: [5, 30],
        unit: '%',
      },
    },
  },
  {
    id: 'backlight',
    label: 'Contre-jour',
    priority: 7,
    variants: {
      on: {
        image: img('backlight'),
        title: (n) => `Contre-jour : visage ${n}× plus sombre que le fond`,
        hint: 'Tourne le sujet vers la lumière ou change d’angle.',
        why: 'Quand la lumière vient de derrière, le visage devient une silhouette sombre, sauf si c’est voulu.',
        range: [2, 5],
        unit: '×',
      },
    },
  },
  {
    id: 'steady',
    label: 'Stabilité',
    priority: 1,
    variants: {
      shaky: {
        image: img('steady'),
        title: () => 'Stabilise l’image',
        hint: 'Appuie tes coudes contre ton corps ou pose le téléphone.',
        why: 'Un tremblement non voulu fatigue le spectateur.',
        range: [0, 0],
        unit: '',
      },
    },
  },
];

/** Maquette affichée quand tous les voyants sont verts. */
export const OK_IMAGE = img('ok');

/** Toutes les maquettes (test : chaque fichier doit exister dans public/coach/). */
export const ALL_IMAGES: readonly string[] = [
  OK_IMAGE,
  ...CHECKS.flatMap((c) => Object.values(c.variants).map((v) => v.image)),
];

export type Reading = { ok: true } | { ok: false; variant: string; amount: number };
export type Readings = Record<CheckId, Reading>;

export type Instruction = {
  check: CheckDef;
  variantKey: string;
  variant: Variant;
  amount: number;
  title: string;
};

const byId = (id: CheckId): CheckDef => CHECKS.find((c) => c.id === id)!;

export function instructionFor(id: CheckId, variantKey: string, amount: number): Instruction {
  const check = byId(id);
  const variant = check.variants[variantKey];
  return { check, variantKey, variant, amount, title: variant.title(amount) };
}

/** La consigne à afficher : le voyant rouge le plus urgent qui n'est pas ignoré. */
export function pickInstruction(readings: Readings, ignored: ReadonlySet<CheckId>): Instruction | null {
  const failing = CHECKS.filter((c) => {
    const r = readings[c.id];
    return !r.ok && !ignored.has(c.id);
  }).sort((a, b) => a.priority - b.priority);
  const first = failing[0];
  if (!first) return null;
  const r = readings[first.id];
  if (r.ok) return null;
  return instructionFor(first.id, r.variant, r.amount);
}

/** Démo : passe un voyant du vert au rouge (variante et valeur au hasard) ou l'inverse. */
export function flipReading(id: CheckId, current: Reading, random: () => number = Math.random): Reading {
  if (!current.ok) return { ok: true };
  const keys = Object.keys(byId(id).variants);
  const variant = keys[Math.floor(random() * keys.length)];
  const [min, max] = byId(id).variants[variant].range;
  return { ok: false, variant, amount: Math.round(min + random() * (max - min)) };
}

/** Tout est vert : aucune consigne. */
export function allOkReadings(): Readings {
  return Object.fromEntries(CHECKS.map((c) => [c.id, { ok: true } as Reading])) as Readings;
}
