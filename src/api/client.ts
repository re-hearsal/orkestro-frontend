import createClient from "openapi-fetch";
import type { paths } from "./schema";

const defaultBaseUrl = import.meta.env.DEV ? "" : "http://localhost:8080";

const client = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? defaultBaseUrl,
});

export default client;
