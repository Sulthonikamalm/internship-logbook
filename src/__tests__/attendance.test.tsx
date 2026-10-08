import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { elapsedSeconds, formatDuration } from "@/features/attendance/domain/duration";

const mocks = vi.hoisted(() => ({ start: vi.fn(), end: vi.fn(), refresh: vi.fn(), success: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/attendance/server/actions", () => ({ startAttendance: mocks.start, endAttendance: mocks.end }));
vi.mock("sonner", () => ({ toast: { success: mocks.success } }));

import { AttendanceCard } from "@/features/attendance/components/attendance-card";
import type { AttendanceSession } from "@/features/attendance/domain/types";

const activeSession: AttendanceSession = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "00000000-0000-4000-8000-000000000002",
  work_date: "2026-10-08",
  timezone: "Asia/Jakarta",
  started_at: "2026-10-08T01:00:00.000Z",
  auto_close_at: "2026-10-08T17:00:00.000Z",
  ended_at: null,
  auto_closed: false,
  created_at: "2026-10-08T01:00:00.000Z",
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("attendance duration", () => {
  it("formats durations beyond one day without wrapping the hour count", () => {
    expect(formatDuration(26 * 3600 + 4 * 60 + 9)).toBe("26:04:09");
  });

  it("uses the saved end time and never returns a negative duration", () => {
    expect(elapsedSeconds(activeSession.started_at, Date.now(), "2026-10-08T02:15:30.000Z")).toBe(4530);
    expect(elapsedSeconds("invalid", Date.now())).toBe(0);
    expect(elapsedSeconds("2026-10-08T02:00:00.000Z", Date.parse("2026-10-08T01:00:00.000Z"))).toBe(0);
  });
});

describe("AttendanceCard", () => {
  it("starts a daily session and refreshes the dashboard state", async () => {
    mocks.start.mockResolvedValue({ ok: true, session: activeSession });
    render(<AttendanceCard initialSession={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Mulai kerja" }));
    await waitFor(() => expect(screen.getByText("Sedang bekerja ·")).toBeTruthy());
    expect(mocks.start).toHaveBeenCalledOnce();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Akhiri kerja" })).toBeTruthy();
  });

  it("ends the active session and shows the saved time range", async () => {
    const finished = { ...activeSession, ended_at: "2026-10-08T08:00:00.000Z" };
    mocks.end.mockResolvedValue({ ok: true, session: finished });
    render(<AttendanceCard initialSession={activeSession} />);
    fireEvent.click(screen.getByRole("button", { name: "Akhiri kerja" }));
    await waitFor(() => expect(screen.getByText(/Selesai · total/)).toBeTruthy());
    expect(mocks.end).toHaveBeenCalledWith(activeSession.id);
    expect(screen.queryByRole("button", { name: "Akhiri kerja" })).toBeNull();
  });

  it("reports action errors without changing the session", async () => {
    mocks.start.mockResolvedValue({ ok: false, message: "Absen gagal." });
    render(<AttendanceCard initialSession={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Mulai kerja" }));
    await screen.findByRole("alert");
    expect(screen.getByText("Belum mulai bekerja")).toBeTruthy();
  });
});
