import type { MeResponse, RotateResponse } from "./types";

export class UnauthorizedError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (resp.status === 401) {
    throw new UnauthorizedError();
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${resp.status}: ${text || resp.statusText}`);
  }
  return (await resp.json()) as T;
}

export const getMe = () => request<MeResponse>("/auth/me");

export const rotateKey = () =>
  request<RotateResponse>("/auth/key/rotate", { method: "POST" });

export const logout = () =>
  request<{ status: string }>("/auth/logout", { method: "POST" });
