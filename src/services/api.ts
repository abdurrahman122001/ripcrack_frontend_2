export type ApiError = { error?: any };

const gatewayBase = import.meta.env.VITE_API_URL || "/api";

class ApiErrorClass extends Error {
  status: number;
  retryAfterMs?: number;
  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

const isProbablyJwt = (token: string) => token.split(".").length === 3;

/** JSON fetch helper that calls backend via Vite proxy (/api -> http://localhost:8080). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as any) },
  });

  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    throw new Error(data?.error ? JSON.stringify(data.error) : `HTTP ${res.status}`);
  }
  return data as T;
}

/** Gateway fetch helper - same as api but with FormData support and better error handling */
export const gatewayFetch = async (path: string, init?: RequestInit) => {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  if (token && !isProbablyJwt(token)) window.localStorage.removeItem("token");
  const effectiveToken = token && isProbablyJwt(token) ? token : null;

  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;

  try {
    const res = await fetch(`${gatewayBase}${path}`, {
      ...init,
      headers: {
        ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
        ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
        ...(init?.headers || {}),
      },
      credentials: "include",
    });

    if (res.status === 401 && typeof window !== "undefined") window.localStorage.removeItem("token");

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const errorMsg = json?.error || `Request failed (${res.status})`;
      const ra = res.headers.get("Retry-After");
      const retryAfterMs = ra && Number.isFinite(Number(ra)) ? Math.max(0, Math.floor(Number(ra) * 1000)) : undefined;
      console.error(`API Error [${path}]:`, errorMsg, res.status);
      throw new ApiErrorClass(errorMsg, res.status, retryAfterMs);
    }
    return json;
  } catch (err: any) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      console.error(`Network Error [${path}]:`, err.message);
      throw new Error("Network error: Backend server may not be running");
    }
    throw err;
  }
};
