import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ActivityForm } from "@/features/activity/components/activity-form";
import { activityDraftKey } from "@/features/activity/domain/draft";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/features/activity/server/create-activity", () => ({ createActivity: mocks.create }));
vi.mock("@/features/activity/server/update-activity", () => ({ updateActivity: mocks.update }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

function DialogHarness({ busy = false }: { busy?: boolean }) {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>Buka dialog</Button><Modal open={open} onClose={() => setOpen(false)} title="Tambah evidence" busy={busy}><label>Judul<input /></label></Modal></>;
}
describe("Accessible interaction regressions", () => {
  it("renders an asChild CTA as one anchor without a nested button", () => {
    render(<Button asChild><a href="/reports">Excel</a></Button>);
    const link = screen.getByRole("link", { name: "Excel" }); expect(link.getAttribute("href")).toBe("/reports");
    expect(link.querySelector("button")).toBeNull(); expect(screen.queryByRole("button")).toBeNull();
  });
  it("focuses the dialog and returns focus to its opener after Escape", async () => {
    render(<DialogHarness />); const opener = screen.getByRole("button", { name: "Buka dialog" }); opener.focus(); fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Tambah evidence" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement!, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
  it("blocks dismissal while an action is pending", async () => {
    render(<DialogHarness busy />); fireEvent.click(screen.getByRole("button", { name: "Buka dialog" }));
    const dialog = await screen.findByRole("dialog"); fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy(); expect((screen.getByRole("button", { name: "Tutup" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("preserves the draft immediately when a save fails before the autosave timer", async () => {
    mocks.create.mockRejectedValue(new Error("Connection lost"));
    render(<ActivityForm userId="qa-owner" timezone="Asia/Jakarta" />);
    fireEvent.change(screen.getByLabelText("Judul aktivitas"), { target: { value: "Work in progress" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan aktivitas" }));
    await screen.findByRole("alert");
    expect(JSON.parse(localStorage.getItem(activityDraftKey("qa-owner", "new"))!).title).toBe("Work in progress");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
