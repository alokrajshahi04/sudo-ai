import type { Job, Capabilities } from "../shared/types";
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: method || (body ? "POST" : "GET"),
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({
    error:
      "Local API is not available. Run npm run dev to start the frontend and backend.",
  }));
  if (!response.ok || data.error)
    throw new Error(data.error || "Request failed.");
  return data as T;
}
export const getCapabilities = () => api<Capabilities>("/capabilities");
export const getJob = (id: string) => api<Job>(`/jobs/${id}`);
