import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Map, Trophy, Award, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/map', icon: Map, label: 'Map' },
  { path: '/tournaments', icon: Trophy, label: 'Tourneys' },
  { path: '/leaderboards', icon: Award, label: 'Leaders' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Don't show nav on certain pages
  const hiddenPaths = ['/onboarding', '/auth'];
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border/50 safe-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'bottom-nav-item',
                isActive && 'bottom-nav-item-active'
              )}
            >
              <Icon className={cn('w-6 h-6', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn('text-xs', isActive ? 'text-primary font-medium' : 'text-muted-foreground')}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
