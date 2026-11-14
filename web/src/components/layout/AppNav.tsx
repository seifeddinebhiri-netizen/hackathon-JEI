import * as Menu from '@radix-ui/react-dropdown-menu';
import { NavLink, useNavigate } from 'react-router';
import { usingMocks } from '@/api';
import { Icon, type IconName } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';

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
        <span aria-hidden className="grid size-6 place-items-center bg-gold font-mono text-label text-ink">
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
          <Menu.Label className="eyebrow px-3 py-2 text-muted-on-light">{user.is_demo ? 'Compte de démo' : user.email}</Menu.Label>
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
      <header data-app-header className="sticky top-0 z-40 bg-ink text-paper">
        <div className="container-pp flex min-h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo to="/projet" />
            {usingMocks ? (
              <span className="eyebrow hidden border border-gold px-2 py-1 whitespace-nowrap text-gold xl:inline" title="VITE_USE_MOCKS=true">
                Données de démonstration
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
                        isActive ? 'border-gold text-paper' : 'border-transparent text-muted-on-dark hover:text-paper',
                      )
                    }
                  >
                    {l.step ? <span className="font-mono text-label text-gold">{l.step}</span> : null}
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <UserMenu />
        </div>
      </header>
      {/* Barre du bas sur mobile */}
      <nav aria-label="Étapes (mobile)" className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line-dark bg-ink md:hidden">
        <ul className="grid grid-cols-5">
          {APP_LINKS.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.to === '/projet'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-16 flex-col items-center justify-center gap-1 border-t-4 text-label font-semibold',
                    isActive ? 'border-gold text-paper' : 'border-transparent text-muted-on-dark',
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
