import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type AppRoute =
  | 'dashboard'
  | 'transactions'
  | 'monthwise'
  | 'statements'
  | 'analytics'
  | 'budgets'
  | 'goals'
  | 'insights'
  | 'debt'
  | 'settings'
  | 'landing';

export const ROUTE_PATHS: Record<AppRoute, string> = {
  landing: '/landing',
  dashboard: '/dashboard',
  transactions: '/transactions',
  monthwise: '/monthwise',
  statements: '/statements',
  analytics: '/analytics',
  budgets: '/budgets',
  goals: '/goals',
  insights: '/insights',
  debt: '/debt',
  settings: '/settings',
};

export const PATH_TO_ROUTE: Record<string, AppRoute> = {
  '/': 'dashboard',
  '/landing': 'landing',
  '/dashboard': 'dashboard',
  '/transactions': 'transactions',
  '/monthwise': 'monthwise',
  '/statements': 'statements',
  '/analytics': 'analytics',
  '/budgets': 'budgets',
  '/goals': 'goals',
  '/insights': 'insights',
  '/debt': 'debt',
  '/settings': 'settings',
};

interface RouterContextType {
  currentRoute: AppRoute;
  pathname: string;
  navigate: (target: AppRoute | string) => void;
  push: (path: string) => void;
  replace: (path: string) => void;
}

const RouterContext = createContext<RouterContextType | null>(null);

function resolvePathToRoute(pathname: string, isAuthenticated: boolean): AppRoute {
  const normalized = pathname.replace(/\/$/, '') || '/';
  
  if (normalized === '/') {
    return isAuthenticated ? 'dashboard' : 'landing';
  }

  if (PATH_TO_ROUTE[normalized]) {
    return PATH_TO_ROUTE[normalized];
  }

  // Fallback match prefix
  for (const [path, route] of Object.entries(PATH_TO_ROUTE)) {
    if (path !== '/' && normalized.startsWith(path)) {
      return route;
    }
  }

  return isAuthenticated ? 'dashboard' : 'landing';
}

interface RouterProviderProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
}

export const RouterProvider: React.FC<RouterProviderProps> = ({ children, isAuthenticated }) => {
  const [pathname, setPathname] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    resolvePathToRoute(typeof window !== 'undefined' ? window.location.pathname : '/', isAuthenticated)
  );

  // Sync route on popstate (browser back / forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const newPath = window.location.pathname || '/';
      setPathname(newPath);
      setCurrentRoute(resolvePathToRoute(newPath, isAuthenticated));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated]);

  // When auth state changes, re-resolve route if at root '/'
  useEffect(() => {
    const currentPath = window.location.pathname || '/';
    if (currentPath === '/' || currentPath === '/landing') {
      const resolved = resolvePathToRoute(currentPath, isAuthenticated);
      setCurrentRoute(resolved);
    }
  }, [isAuthenticated]);

  const navigate = useCallback(
    (target: AppRoute | string) => {
      let targetPath: string;
      let targetRoute: AppRoute;

      if (target in ROUTE_PATHS) {
        targetRoute = target as AppRoute;
        targetPath = ROUTE_PATHS[targetRoute];
      } else {
        targetPath = target.startsWith('/') ? target : `/${target}`;
        targetRoute = resolvePathToRoute(targetPath, isAuthenticated);
      }

      if (typeof window !== 'undefined') {
        if (window.location.pathname !== targetPath) {
          window.history.pushState(null, '', targetPath);
        }
      }

      setPathname(targetPath);
      setCurrentRoute(targetRoute);
    },
    [isAuthenticated]
  );

  const push = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  const replace = useCallback(
    (path: string) => {
      let targetPath = path.startsWith('/') ? path : `/${path}`;
      let targetRoute = resolvePathToRoute(targetPath, isAuthenticated);

      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', targetPath);
      }

      setPathname(targetPath);
      setCurrentRoute(targetRoute);
    },
    [isAuthenticated]
  );

  return (
    <RouterContext.Provider
      value={{
        currentRoute,
        pathname,
        navigate,
        push,
        replace,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

export function useRouter(): RouterContextType {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}
