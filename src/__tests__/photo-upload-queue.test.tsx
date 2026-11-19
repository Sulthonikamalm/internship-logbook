import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PhotoUploader } from "@/features/evidence/components/photo-uploader";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/features/evidence/domain/browser-upload", () => ({ uploadBrowserPhoto: mocks.upload }));
beforeEach(() => { vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() })); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const files = () => [new File(["image"], "one.png", { type: "image/png" }), new File(["image"], "two.png", { type: "image/png" })];
function select() { fireEvent.change(screen.getByLabelText("Pilih beberapa foto atau tempel gambar"), { target: { files: files() } }); }
describe("Photo upload queue", () => {
  it("uploads multiple files and serializes attachment callbacks", async () => {
    mocks.upload.mockImplementation(async (_file, id) => ({ evidenceId: id }));
    let active = 0; let maximum = 0;
    const attached = vi.fn(async () => { active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 10)); active--; });
    render(<PhotoUploader onUploaded={attached} />); select();
    fireEvent.click(screen.getByRole("button", { name: "Unggah / lanjutkan 2 foto" }));
    await screen.findByText("Semua foto siap digunakan.");
    expect(mocks.upload).toHaveBeenCalledTimes(2); expect(attached).toHaveBeenCalledTimes(2); expect(maximum).toBe(1);
  });
  it("continues another file after failure and resumes only the failed file", async () => {
    mocks.upload.mockImplementation(async (file, id) => { if (file.name === "one.png") throw new Error("Koneksi terputus"); return { evidenceId: id }; });
    render(<PhotoUploader />); select(); fireEvent.click(screen.getByRole("button", { name: "Unggah / lanjutkan 2 foto" }));
    await screen.findByText("Koneksi terputus"); await waitFor(() => expect(screen.getByText("1 dari 2 foto siap")).toBeTruthy());
    mocks.upload.mockImplementation(async (_file, id) => ({ evidenceId: id }));
    fireEvent.click(screen.getByRole("button", { name: "Lanjutkan upload" }));
    await screen.findByText("Semua foto siap digunakan."); expect(mocks.upload).toHaveBeenCalledTimes(3);
  });
  it("retries attachment without uploading a saved image again", async () => {
    mocks.upload.mockResolvedValue({ evidenceId: "existing" });
    const attached = vi.fn().mockRejectedValueOnce(new Error("attach failed")).mockResolvedValue(undefined);
    render(<PhotoUploader onUploaded={attached} />);
    fireEvent.change(screen.getByLabelText("Pilih beberapa foto atau tempel gambar"), { target: { files: [files()[0]] } });
    fireEvent.click(screen.getByRole("button", { name: "Unggah / lanjutkan 1 foto" }));
    await screen.findByRole("button", { name: "Lampirkan lagi" });
    fireEvent.click(screen.getByRole("button", { name: "Lampirkan lagi" }));
    await screen.findByText("Semua foto siap digunakan."); expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
});
