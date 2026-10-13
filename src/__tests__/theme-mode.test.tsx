import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import * as React from "react";
import { ThemeProvider, useTheme } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ThemePreferenceCard } from "@/features/settings/components/theme-preference-card";

function TestConsumer() {
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <button
        data-testid="toggle-btn"
        onClick={(e) => toggleTheme(e)}
      >
        Toggle
      </button>
      <button
        data-testid="set-dark"
        onClick={() => setTheme("dark")}
      >
        Set Dark
      </button>
      <button
        data-testid="set-system"
        onClick={() => setTheme("system")}
      >
        Set System
      </button>
    </div>
  );
}

describe("Theme System & Dark Mode", () => {
  let originalMatchMedia: typeof window.matchMedia;
  let matchesDark = false;
  let mediaListeners: Array<() => void> = [];

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
    matchesDark = false;
    mediaListeners = [];

    originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      const isDarkModeQuery = query.includes("prefers-color-scheme: dark");

      return {
        get matches() {
          return isDarkModeQuery ? matchesDark : false;
        },
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, callback: () => void) => {
          if (event === "change" && isDarkModeQuery) {
            mediaListeners.push(callback);
          }
        }),
        removeEventListener: vi.fn((event: string, callback: () => void) => {
          if (event === "change" && isDarkModeQuery) {
            mediaListeners = mediaListeners.filter((cb) => cb !== callback);
          }
        }),
        dispatchEvent: vi.fn(),
      };
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("initializes with system preference and applies light class by default", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("system");
    expect(screen.getByTestId("resolved-theme").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("reads stored dark theme from localStorage on initial render", () => {
    localStorage.setItem("internflow-theme", "dark");

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(screen.getByTestId("resolved-theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("toggles theme from light to dark and persists to localStorage", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId("toggle-btn");
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId("resolved-theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem("internflow-theme")).toBe("dark");

    // Toggle back to light
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("resolved-theme").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem("internflow-theme")).toBe("light");
  });

  it("executes View Transitions wave ripple animation when document.startViewTransition exists", () => {
    const animateMock = vi.fn();
    document.documentElement.animate = animateMock;

    let callbackExecuted = false;
    const startViewTransitionMock = vi.fn().mockImplementation((cb: () => void) => {
      cb();
      callbackExecuted = true;
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
      };
    });

    (document as unknown as { startViewTransition: typeof startViewTransitionMock }).startViewTransition =
      startViewTransitionMock;

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId("toggle-btn");
    fireEvent.click(toggleBtn, { clientX: 200, clientY: 150 });

    expect(startViewTransitionMock).toHaveBeenCalled();
    expect(callbackExecuted).toBe(true);
    expect(screen.getByTestId("resolved-theme").textContent).toBe("dark");

    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  });

  it("syncs theme across browser tabs via storage events", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    act(() => {
      localStorage.setItem("internflow-theme", "dark");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "internflow-theme",
          newValue: "dark",
        })
      );
    });

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(screen.getByTestId("resolved-theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("adapts when system color-scheme changes in system mode", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("system");
    expect(screen.getByTestId("resolved-theme").textContent).toBe("light");

    // Simulate system preference change to dark
    matchesDark = true;
    act(() => {
      mediaListeners.forEach((listener) => listener());
    });

    expect(screen.getByTestId("resolved-theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("renders ThemeToggle with accessible button and handles click", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button");
    expect(button).toBeDefined();
    expect(button.getAttribute("aria-label")).toContain("Beralih ke mode malam");

    fireEvent.click(button);

    expect(button.getAttribute("aria-label")).toContain("Beralih ke mode terang");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("renders ThemePreferenceCard and switches among Light, Dark, System", () => {
    render(
      <ThemeProvider>
        <ThemePreferenceCard />
      </ThemeProvider>
    );

    expect(screen.getByText("Tampilan & Mode Malam")).toBeDefined();
    expect(screen.getByText("Terang")).toBeDefined();
    expect(screen.getByText("Gelap (Malam)")).toBeDefined();
    expect(screen.getByText("Sistem")).toBeDefined();

    // Select Dark
    fireEvent.click(screen.getByText("Gelap (Malam)"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("internflow-theme")).toBe("dark");

    // Select Light
    fireEvent.click(screen.getByText("Terang"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("internflow-theme")).toBe("light");
  });
});
