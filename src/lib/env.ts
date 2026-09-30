/**
 * Re-export from split modules for backward compatibility.
 * New code should import from @/lib/env/client or @/lib/env/server directly.
 *
 * @deprecated Use @/lib/env/client or @/lib/env/server instead.
 */
export { clientEnvSchema, getClientEnv } from "./env/client";
export type { ClientEnv } from "./env/client";

// Note: serverEnvSchema and getServerEnv are NOT re-exported here
// because this file may be imported from client components.
// Server-only env must be imported from @/lib/env/server explicitly.
