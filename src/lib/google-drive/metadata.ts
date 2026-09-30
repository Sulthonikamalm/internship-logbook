import "server-only";
import { driveFetch, getDriveConfig } from "./client";
import { DriveError } from "./errors";

export type DriveFileMetadata = {
  id: string; name: string; mimeType: string; size?: string;
  parents?: string[]; appProperties?: Record<string, string>;
};

export async function getDriveMetadata(fileId: string): Promise<DriveFileMetadata> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("fields", "id,name,mimeType,size,parents,appProperties,trashed");
  const response = await driveFetch(url.toString());
  const file = await response.json() as DriveFileMetadata & { trashed?: boolean };
  if (file.trashed) throw new DriveError("NOT_FOUND");
  return file;
}

export async function assertPrivateDriveRoot(): Promise<string> {
  const rootId = getDriveConfig().rootFolderId;
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rootId)}`);
  url.searchParams.set("fields", "id,mimeType,trashed,permissions(type,role)");
  const response = await driveFetch(url.toString());
  const root = await response.json() as {
    id: string; mimeType: string; trashed?: boolean;
    permissions?: { type: string; role: string }[];
  };
  if (root.trashed || root.mimeType !== "application/vnd.google-apps.folder" ||
      !Array.isArray(root.permissions) ||
      root.permissions.some((permission) => permission.type !== "user" || permission.role !== "owner")) {
    throw new DriveError("FORBIDDEN");
  }
  return rootId;
}

async function findOrCreateFolder(parentId: string, name: string): Promise<string> {
  const query = new URL("https://www.googleapis.com/drive/v3/files");
  query.searchParams.set("q", `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  query.searchParams.set("fields", "files(id,name),nextPageToken");
  query.searchParams.set("pageSize", "10");
  const found = await (await driveFetch(query.toString())).json() as { files?: { id: string }[] };
  if (found.files?.[0]?.id) return found.files[0].id;
  const created = await driveFetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  const file = await created.json() as { id?: string };
  if (!file.id) throw new DriveError("SERVER");
  return file.id;
}

export async function ensureUserMonthFolder(userId: string, localDate: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new DriveError("UNKNOWN");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new DriveError("UNKNOWN");
  let parentId = await assertPrivateDriveRoot();
  for (const segment of ["users", userId, localDate.slice(0, 4), localDate.slice(5, 7)]) {
    parentId = await findOrCreateFolder(parentId, segment);
  }
  return parentId;
}
