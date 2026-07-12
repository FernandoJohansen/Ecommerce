import { clearToken, getToken } from "./auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  // "detail" do FastAPI quando é uma string pronta para o usuário
  detail: string | null;

  constructor(path: string, status: number, detail: string | null) {
    super(detail ?? `API ${path} → ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}/api${path}`, { ...init, headers });
  // A 401 on an authenticated call means the stored token expired or was
  // revoked; drop it and start over at the login page. (401s without a token,
  // e.g. a wrong password on /auth/login, stay with the caller.)
  if (res.status === 401 && token && typeof window !== "undefined") {
    clearToken();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }
  if (!res.ok) {
    let detail: string | null = null;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // corpo vazio ou não-JSON
    }
    throw new ApiError(path, res.status, detail);
  }
  return res.json() as Promise<T>;
}
