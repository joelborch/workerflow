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
