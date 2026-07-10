import { clearToken, getToken } from "./auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

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
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}
