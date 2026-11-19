import { createElement, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { SharedPhotoViewer } from "@/features/reports/components/shared-photo-viewer";

vi.mock("next/image", () => ({ default: ({ src, alt, width, height, loading, fetchPriority }: ComponentProps<"img">) =>
  createElement("img", { src, alt, width, height, loading, fetchPriority }) }));

const BrowserURL = URL;
const fetchPhoto = vi.fn();
const createObjectURL = vi.fn(() => "blob:report-photo");
const revokeObjectURL = vi.fn();
const token = "A".repeat(43);
const props = { shareId: "share", evidenceId: "photo" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchPhoto);
  vi.stubGlobal("URL", class extends BrowserURL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  window.location.hash = token;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.location.hash = ""; });

function photoResponse(name: string) {
  return new Response(new Uint8Array([1, 2, 3]), { headers: {
    "Content-Type": "image/webp", "X-InternFlow-Owner-Name": encodeURIComponent(name),
    "X-InternFlow-Photo-Width": "960", "X-InternFlow-Photo-Height": "540",
  } });
}

describe("shared report photo identity and loading", () => {
  it("shows the server-provided name while the image request is still pending", () => {
    fetchPhoto.mockReturnValueOnce(new Promise(() => {}));
    render(<SharedPhotoViewer {...props} initialOwnerName="Nur Alifia Rustan" />);
    expect(screen.getByRole("heading", { name: "Foto lampiran laporan Nur Alifia Rustan" })).toBeTruthy();
    expect(screen.getByText("Memuat foto…")).toBeTruthy();
  });
  it.each(["Sulthonika", "Alifa Éka"])("labels the report using uploader %s", async name => {
    fetchPhoto.mockResolvedValueOnce(photoResponse(name));
    const { unmount } = render(<SharedPhotoViewer {...props} />);
    expect(screen.getByAltText("InternFlow")).toBeTruthy();
    expect(screen.getByText("by Sulthonika")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: `Foto lampiran laporan ${name}` })).toBeTruthy();
    const photo = await screen.findByAltText(`Foto lampiran laporan ${name}`);
    expect(photo.getAttribute("src")).toBe("blob:report-photo");
    expect(photo.getAttribute("width")).toBe("960");
    expect(photo.getAttribute("height")).toBe("540");
    expect(photo.getAttribute("loading")).toBe("eager");
    expect(photo.getAttribute("fetchpriority")).toBe("high");
    const [url, options] = fetchPhoto.mock.calls[0];
    expect(url).toBe("/api/reports/shared-photo");
    expect(JSON.parse(options.body)).toMatchObject({ ...props, token });
    expect(options.cache).toBe("no-store");
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report-photo");
  });

  it("requests a smaller preview on a phone", async () => {
    const previous = window.innerWidth;
    window.innerWidth = 390;
    try {
      fetchPhoto.mockResolvedValueOnce(photoResponse("Alifa"));
      render(<SharedPhotoViewer {...props} />);
      await screen.findByAltText("Foto lampiran laporan Alifa");
      expect(JSON.parse(fetchPhoto.mock.calls[0][1].body).maxWidth).toBe(960);
    } finally { window.innerWidth = previous; }
  });

  it("does not fetch or reveal an uploader when the fragment is missing", async () => {
    window.location.hash = "";
    render(<SharedPhotoViewer {...props} />);
    expect(await screen.findByText("Tautan foto tidak lengkap. Buka dari file Excel.")).toBeTruthy();
    expect(fetchPhoto).not.toHaveBeenCalled();
    expect(screen.getByRole("heading").textContent).toBe("Foto lampiran laporan");
  });

  it("does not reveal a name or create an image for a revoked link", async () => {
    fetchPhoto.mockResolvedValueOnce(new Response("unavailable", { status: 404, headers: { "X-InternFlow-Owner-Name": "Alifa" } }));
    render(<SharedPhotoViewer {...props} />);
    await waitFor(() => expect(screen.getByText("Tautan berakhir, dicabut, atau foto tidak tersedia.")).toBeTruthy());
    expect(screen.getByRole("heading").textContent).toBe("Foto lampiran laporan");
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
