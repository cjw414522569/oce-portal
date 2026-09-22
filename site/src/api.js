export function normalizeUrl(value) {
  let url = value.trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}

export class OCEApi {
  constructor(url, key) { this.url = normalizeUrl(url); this.key = key.trim(); }
  async request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${this.url}${path}`, { ...options, headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${this.key}`, ...(options.headers || {}) } });
    } catch { throw new Error("NETWORK_ERROR"); }
    const raw = await response.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
    if (!response.ok) { const detail = typeof body?.detail === "string" ? body.detail : body?.detail?.error?.message || body?.message || `HTTP ${response.status}`; const error = new Error(detail); error.status = response.status; throw error; }
    return body;
  }
  health() { return this.request("/health"); }
  version() { return this.request("/version"); }
  stats() { return this.request("/admin/stats?window_hours=24"); }
  queue() { return this.request("/admin/queue"); }
  queueThroughput() { return this.request("/admin/queue/throughput"); }
  clearFailed(limit = 1000) { return this.request("/admin/queue/clear-failed", { method: "POST", body: JSON.stringify({ limit }) }); }
  credentials() { return this.request("/admin/credentials"); }
  reloadCredentials() { return this.request("/admin/credentials/reload", { method: "POST" }); }
  createCredential(payload) { return this.request("/admin/credentials", { method: "POST", body: JSON.stringify(payload) }); }
  updateCredential(id, payload) { return this.request(`/admin/credentials/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
  deleteCredential(id) { return this.request(`/admin/credentials/${id}`, { method: "DELETE" }); }
  duplicateCredential(id, payload) { return this.request(`/admin/credentials/${id}/duplicate`, { method: "POST", body: JSON.stringify(payload) }); }
  resetQueue(payload) { return this.request("/admin/queue/reset", { method: "POST", body: JSON.stringify(payload) }); }
  requeueStale(payload) { return this.request("/admin/queue/requeue-stale", { method: "POST", body: JSON.stringify(payload) }); }
  gc(payload) { return this.request("/admin/gc", { method: "POST", body: JSON.stringify(payload) }); }
  users(params) {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")) : "";
    return this.request(`/admin/users${qs ? `?${qs}` : ""}`);
  }
  setUserStatus(id, status) { return this.request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); }
  deleteUser(id) { return this.request(`/admin/users/${id}`, { method: "DELETE" }); }
  batchDeleteUsers(ids) { return this.request("/admin/users/batch-delete", { method: "POST", body: JSON.stringify({ user_ids: ids }) }); }
  deleteUsersRegistered(dateFrom, dateTo, dryRun) { return this.request("/admin/users/delete-registered", { method: "POST", body: JSON.stringify({ date_from: dateFrom, date_to: dateTo, dry_run: dryRun }) }); }
  registrationInfo() { return this.request("/admin/users/registration"); }
  setMaxUsers(maxUsers) { return this.request("/admin/users/registration", { method: "PATCH", body: JSON.stringify({ max_users: maxUsers }) }); }
  reportApiCalls(windowHours = 24, bucket = "hour") { return this.request(`/admin/reports/api-calls?window_hours=${windowHours}&bucket=${bucket}`); }
  reportRetrieval(windowHours = 24, bucket = "hour") { return this.request(`/admin/reports/retrieval?window_hours=${windowHours}&bucket=${bucket}`); }
  reportSlowQueries(windowHours = 24, limit = 50) { return this.request(`/admin/reports/retrieval/slow-queries?window_hours=${windowHours}&limit=${limit}`); }
  reportEmptyQueries(windowHours = 24, limit = 50) { return this.request(`/admin/reports/retrieval/empty-queries?window_hours=${windowHours}&limit=${limit}`); }
  reportTokens(windowHours = 24, bucket = "hour") { return this.request(`/admin/reports/tokens?window_hours=${windowHours}&bucket=${bucket}`); }
  reportIndexInventory() { return this.request("/admin/reports/index-inventory"); }
  reportResources(windowHours = 24, bucket = "hour") { return this.request(`/admin/reports/resources?window_hours=${windowHours}&bucket=${bucket}`); }
  reportStorage() { return this.request("/admin/reports/storage"); }
}
