/**
 * Vitest setup file.
 * Mocks server-only to allow importing server modules in test environment.
 */
import { vi } from "vitest";

// Mock 'server-only' to prevent it from throwing in test environment
vi.mock("server-only", () => ({}));
