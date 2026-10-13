"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeTransitionOrigin {
  clientX?: number;
  clientY?: number;
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme, origin?: ThemeTransitionOrigin | React.MouseEvent) => void;
  toggleTheme: (origin?: ThemeTransitionOrigin | React.MouseEvent) => void;
  mounted: boolean;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "internflow-theme";

const themeListeners = new Set<() => void>();

function notifyThemeListeners() {
  themeListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore listener error
    }
  });
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") {
    return getSystemTheme();
  }
  return theme;
}

function getThemeSnapshot(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const theme: Theme =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    const resolved = resolveTheme(theme);
    return `${theme}:${resolved}`;
  } catch {
    return "system:light";
  }
}

function getServerSnapshot(): string {
  return "system:light";
}

function subscribeTheme(callback: () => void) {
  themeListeners.add(callback);

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback();
    }
  };
  window.addEventListener("storage", handleStorage);

  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handleMedia = () => {
    callback();
  };
  mql.addEventListener("change", handleMedia);

  return () => {
    themeListeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
    mql.removeEventListener("change", handleMedia);
  };
}

function applyThemeToDOM(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
}

const emptySubscribe = () => () => {};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const composite = React.useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerSnapshot);
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [theme, resolvedTheme] = React.useMemo(() => {
    const [t, r] = composite.split(":") as [Theme, ResolvedTheme];
    return [t, r];
  }, [composite]);

  // Synchronize DOM classes whenever resolvedTheme changes
  React.useEffect(() => {
    applyThemeToDOM(resolvedTheme);
  }, [resolvedTheme]);

  // Transition theme with circular wave ripple effect
  const changeThemeWithTransition = React.useCallback(
    (newTheme: Theme, origin?: ThemeTransitionOrigin | React.MouseEvent) => {
      const nextResolved = resolveTheme(newTheme);

      // Check if coordinates were provided or extract from active element
      let x = origin && "clientX" in origin && origin.clientX !== undefined ? origin.clientX : undefined;
      let y = origin && "clientY" in origin && origin.clientY !== undefined ? origin.clientY : undefined;

      if ((x === undefined || y === undefined) && typeof document !== "undefined") {
        const active = document.activeElement as HTMLElement | null;
        if (active && typeof active.getBoundingClientRect === "function") {
          const rect = active.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        } else if (typeof window !== "undefined") {
          x = window.innerWidth / 2;
          y = window.innerHeight / 2;
        }
      }

      const clientX = x ?? (typeof window !== "undefined" ? window.innerWidth / 2 : 0);
      const clientY = y ?? (typeof window !== "undefined" ? window.innerHeight / 2 : 0);

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const commitChange = () => {
        try {
          localStorage.setItem(STORAGE_KEY, newTheme);
        } catch {
          // Ignore storage write error
        }
        applyThemeToDOM(nextResolved);
        notifyThemeListeners();
      };

      // Check for document.startViewTransition support
      const docWithTransition = document as unknown as {
        startViewTransition?: (callback: () => void | Promise<void>) => {
          ready: Promise<void>;
          finished: Promise<void>;
        };
      };

      if (!docWithTransition.startViewTransition || prefersReducedMotion) {
        commitChange();
        return;
      }

      // Calculate maximum distance to the furthest screen corner for full ripple expansion
      const endRadius = Math.hypot(
        Math.max(clientX, window.innerWidth - clientX),
        Math.max(clientY, window.innerHeight - clientY)
      );

      const transition = docWithTransition.startViewTransition(() => {
        commitChange();
      });

      transition.ready
        .then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${clientX}px ${clientY}px)`,
                `circle(${endRadius}px at ${clientX}px ${clientY}px)`,
              ],
            },
            {
              duration: 520,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            }
          );
        })
        .catch(() => {
          // Fallback if animation throws
        });
    },
    []
  );

  const toggleTheme = React.useCallback(
    (origin?: ThemeTransitionOrigin | React.MouseEvent) => {
      const nextTheme: Theme = resolvedTheme === "dark" ? "light" : "dark";
      changeThemeWithTransition(nextTheme, origin);
    },
    [resolvedTheme, changeThemeWithTransition]
  );

  const setTheme = React.useCallback(
    (newTheme: Theme, origin?: ThemeTransitionOrigin | React.MouseEvent) => {
      changeThemeWithTransition(newTheme, origin);
    },
    [changeThemeWithTransition]
  );

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
      mounted,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme, mounted]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
