import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  // Recharts relies on ResizeObserver, which jsdom does not provide.
  const target = globalThis as unknown as { ResizeObserver?: typeof ResizeObserverMock };
  target.ResizeObserver = ResizeObserverMock;
}

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: createStorageMock(),
});
