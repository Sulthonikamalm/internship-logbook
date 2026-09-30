import { z } from "zod";

/**
 * Login form validation schema.
 * - Email: trimmed, lowercased
 * - Password: NOT trimmed (spaces may be intentional)
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email wajib diisi.")
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email("Format email tidak valid.")),
  password: z
    .string()
    .min(1, "Password wajib diisi."),
});

export type LoginInput = z.infer<typeof loginSchema>;
