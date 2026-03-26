export const BOTTOM_TAB_PATHS = ['/', '/map', '/squads', '/leaderboards', '/profile'] as const;

export type BottomTabPath = (typeof BOTTOM_TAB_PATHS)[number];

export function getBottomTabIndex(pathname: string): number {
  return BOTTOM_TAB_PATHS.findIndex((path) => path === pathname);
}

export function isBottomTabPath(pathname: string): pathname is BottomTabPath {
  return getBottomTabIndex(pathname) >= 0;
}

export function getAdjacentBottomTab(pathname: string, delta: -1 | 1): BottomTabPath | null {
  const currentIndex = getBottomTabIndex(pathname);
  if (currentIndex < 0) return null;
  const nextIndex = currentIndex + delta;
  if (nextIndex < 0 || nextIndex >= BOTTOM_TAB_PATHS.length) return null;
  return BOTTOM_TAB_PATHS[nextIndex];
}
