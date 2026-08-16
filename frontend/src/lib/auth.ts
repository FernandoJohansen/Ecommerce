import { apiFetch } from "./api";

const TOKEN_KEY = "cv_token";
const ROLE_KEY = "cv_role";

export type Role = "customer" | "staff" | "admin";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

// UI-only hint for showing admin/staff links; real access is enforced by the backend.
export function setRole(role: Role): void {
  localStorage.setItem(ROLE_KEY, role);
}

export function getRole(): Role {
  if (typeof window === "undefined") return "customer";
  const role = localStorage.getItem(ROLE_KEY);
  return role === "admin" || role === "staff" ? role : "customer";
}

export function isAdmin(): boolean {
  return getRole() === "admin";
}

export function isStaff(): boolean {
  return getRole() === "staff" || getRole() === "admin";
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getUserEmail(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return (payload.email as string) ?? null;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // token may already be invalid/expired — clearing it locally is enough
  } finally {
    clearToken();
  }
}
