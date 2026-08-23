import createClient from "openapi-fetch";
import type { paths } from "./schema";

const defaultBaseUrl = import.meta.env.DEV ? "" : "http://localhost:8080";

const client = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? defaultBaseUrl,
});

// Escape hatch for call sites that need a dynamic path the typed client can't infer.
export type UnsafeApiMethod = (
  path: string,
  options?: unknown
) => Promise<{ data?: unknown; error?: unknown }>;

export default client;
