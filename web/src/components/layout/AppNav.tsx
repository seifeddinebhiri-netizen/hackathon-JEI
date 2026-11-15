import * as Menu from '@radix-ui/react-dropdown-menu';
import { Link, NavLink, useNavigate } from 'react-router';
import { usingMocks } from '@/api';
import { Icon, type IconName } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { cn } from '@/lib/cn';
import { brand } from '@/app/brand';

const APP_LINKS: { to: string; label: string; step?: string; icon: IconName }[] = [
  { to: '/projet', label: 'Projet', icon: 'home' },
  { to: '/planner', label: 'Planifier', step: '1', icon: 'calendar' },
  { to: '/coach', label: 'Tourner', step: '2', icon: 'phone' },
  { to: '/passeport', label: 'Déclarer', step: '3', icon: 'shield' },
  { to: '/festival', label: 'Diffuser', step: '4', icon: 'film' },
];

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <Menu.Root>
      <Menu.Trigger className="inline-flex min-h-11 items-center gap-2 border-2 border-line-dark px-3 text-meta hover:border-paper">
        <span
          aria-hidden
          className="grid size-6 place-items-center rounded-full bg-header-accent text-[12px] font-semibold text-ink"
        >
          {user.name.charAt(0)}
        </span>
        <span className="hidden sm:inline">{user.name}</span>
        <Icon name="chevronDown" size={16} />
        <span className="sr-only">Menu du compte</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-56 border-2 border-ink bg-paper p-1 text-ink shadow-hard"
        >
          <Menu.Label className="eyebrow px-3 py-2 text-muted-on-light">
            {user.is_demo ? 'Compte de démo' : user.email}
          </Menu.Label>
          <Menu.Item
            onSelect={() => navigate('/mes-donnees')}
            className="flex min-h-11 cursor-pointer items-center gap-2 px-3 outline-none data-[highlighted]:bg-gold-soft"
          >
            <Icon name="lock" size={18} /> Mes données
          </Menu.Item>
          <Menu.Separator className="my-1 h-0.5 bg-line-light" />
          <Menu.Item
            onSelect={() => {
              void signOut().then(() => navigate('/'));
            }}
            className="flex min-h-11 cursor-pointer items-center gap-2 px-3 outline-none data-[highlighted]:bg-gold-soft"
          >
            <Icon name="logout" size={18} /> Se déconnecter
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function AppNav() {
  return (
    <>
      <header data-app-header className="sticky top-0 z-40 bg-header text-paper">
        <div className="container-pp flex min-h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/projet"
              className="inline-flex min-h-11 items-center font-display text-[26px] leading-none font-bold tracking-[-0.02em] text-paper"
              aria-label={`${brand.name}, accueil du projet`}
            >
              <span aria-hidden>
                encadr<span className="text-header-accent">é</span>
              </span>
            </Link>
            {usingMocks ? (
              <span
                className="rounded border border-header-accent px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-header-accent uppercase"
                title="Données de démonstration"
              >
                Démo
              </span>
            ) : null}
          </div>
          <nav aria-label="Étapes" className="hidden md:block">
            <ul className="flex items-center">
              {APP_LINKS.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    end={l.to === '/projet'}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-16 items-center gap-2 border-b-4 px-2 text-meta font-semibold whitespace-nowrap lg:px-4',
                        isActive
                          ? 'border-header-accent text-paper'
                          : 'border-transparent text-muted-on-dark hover:text-paper',
                      )
                    }
                  >
                    {l.step ? `${l.step} · ${l.label}` : l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <UserMenu />
        </div>
      </header>
      {/* Barre du bas sur mobile */}
      <nav
        aria-label="Étapes (mobile)"
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line-dark bg-header md:hidden"
      >
        <ul className="grid grid-cols-5">
          {APP_LINKS.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.to === '/projet'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-16 flex-col items-center justify-center gap-1 border-t-4 text-label font-semibold',
                    isActive ? 'border-header-accent text-paper' : 'border-transparent text-muted-on-dark',
                  )
                }
              >
                <Icon name={l.icon} size={20} />
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
