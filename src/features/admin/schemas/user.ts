import { z } from "zod";
export const createManagedUserSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Email tidak valid.")),
  password: z.string().min(12, "Password minimal 12 karakter.").max(128),
}).strict();
