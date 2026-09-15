export interface AuthUser {
  id: number;
  username: string;
  name: string | null;
  avatar_template: string | null;
  trust_level: number;
}

export interface AuthApiKey {
  key_last4: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
  api_key: string | null;
}

export interface AuthUsageWindow {
  window_hours: number;
  api_calls: number;
  total_tokens: number;
}

export interface MeResponse {
  user: AuthUser;
  api_key: AuthApiKey | null;
  usage_24h: AuthUsageWindow;
  usage_7d: AuthUsageWindow;
}

export interface RotateResponse {
  api_key: string;
  key_last4: string;
}
