<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox, ElNotification } from "element-plus";
import { en, zhCn } from "element-plus/es/locale/index.mjs";
import {
  ArrowRight,
  Check,
  Clock,
  Connection,
  CopyDocument,
  Delete,
  EditPen,
  Files as Archive,
  Key,
  List,
  Lock,
  Monitor,
  Plus,
  Refresh,
  RefreshLeft,
  Search,
  Setting,
  SwitchButton,
  Tools,
  TrendCharts,
  User,
  Warning,
} from "@element-plus/icons-vue";
import { OCEApi, normalizeUrl } from "./api";
import { fetchMe, loginUrl, logout } from "./auth";
import ReportsView from "./ReportsView.vue";
import UserView from "./UserView.vue";
import GuideView from "./GuideView.vue";
import UsersAdminView from "./UsersAdminView.vue";

const { t, locale } = useI18n();
const logoUrl = new URL("../assets/oce-mark.svg", import.meta.url).href;
// 门户与后端同源部署（默认形态）直接用当前 origin；本地 dev 回落本机后端
const DEV = /^(localhost|127\.0\.0\.1)(:|$)/.test(window.location.host);
const DEFAULT_URL = DEV ? "http://127.0.0.1:8986" : window.location.origin;
const DEFAULT_KEY = "sk-opencontextengine";
const storage = {
  url: "oce-admin.url",
  key: "oce-admin.key",
  remember: "oce-admin.remember",
  locale: "oce-admin.locale",
};
const pageOrigin = window.location.origin;
const screen = ref("connect");
const activeView = ref("overview");
const me = ref(null);
const sessionReady = ref(false);
const loading = ref(false);
const loadingData = ref(false);
const connectionError = ref("");
const api = ref(null);
const version = ref(null);
const stats = ref(null);
const queue = ref(null);
const credentials = ref([]);
const activity = ref([]);
const activeReportTab = ref("overview");
const reportWindow = ref(24);
const reports = reactive({
  apiCalls: null,
  retrieval: null,
  slowQueries: null,
  emptyQueries: null,
  tokens: null,
  inventory: null,
  resources: null,
  storage: null,
  loading: { apiCalls: false, retrieval: false, slowQueries: false, emptyQueries: false, tokens: false, inventory: false, resources: false, storage: false },
  errors: { apiCalls: "", retrieval: "", slowQueries: "", emptyQueries: "", tokens: "", inventory: "", resources: "", storage: "" },
  fetched: false,
  snapshotAt: 0,
});
const showConnectKey = ref(false);
const showSettingsKey = ref(false);
const credentialDialog = ref(false);
const duplicateDialog = ref(false);
const editingCredential = ref(null);
const duplicateSourceKind = ref("");
const credentialFormRef = ref(null);
const credentialSubmitting = ref(false);
const duplicateSubmitting = ref(false);
const searchQuery = ref("");
const statusFilter = ref("all");
const operationLoading = reactive({
  reload: false,
  reset: false,
  stale: false,
  gc: false,
});
const gcResult = ref(null);
const connectForm = reactive({
  url: DEFAULT_URL,
  key: DEFAULT_KEY,
  remember: true,
});
const settingsForm = reactive({
  url: DEFAULT_URL,
  key: DEFAULT_KEY,
  remember: true,
});
const queueForm = reactive({ mode: "sync", requeue: true });
const staleForm = reactive({ stale_hours: 24, limit: 100 });
const gcForm = reactive({ ttl_days: 30, limit: 1000, dry_run: true });
function defaultDuplicate() {
  return {
    id: null,
    name: "",
    api_key: "",
    kind: "",
    provider: "",
    status: "",
    priority: null,
    endpoint: "",
    model: "",
    timeout_seconds: null,
    rate_limit: null,
    note: "",
    dimensions: null,
    max_batch_size: null,
    max_batch_chars: null,
    max_input_chars: null,
    input_overlap_chars: null,
    top_n: null,
    min_score: null,
    tpm_limit: null,
    max_candidates: null,
    output_top_k: null,
    snippet_chars: null,
    num_rewrites: null,
  };
}
const duplicateForm = reactive(defaultDuplicate());
const duplicateEffectiveKind = computed(
  () => duplicateForm.kind || duplicateSourceKind.value,
);

function defaultCredential() {
  return {
    id: null,
    kind: "embed",
    name: "",
    api_key: "",
    provider: "",
    status: "active",
    priority: 100,
    endpoint: "",
    model: "",
    timeout_seconds: 30,
    rate_limit: null,
    note: "",
    dimensions: null,
    max_batch_size: null,
    max_batch_chars: null,
    max_input_chars: null,
    input_overlap_chars: null,
    top_n: null,
    min_score: null,
    tpm_limit: null,
    max_candidates: null,
    output_top_k: null,
    snippet_chars: null,
    num_rewrites: null,
  };
}
const credentialForm = reactive(defaultCredential());
const userNavItems = computed(() => [
  { key: "user", label: t("myKey"), icon: User },
  { key: "guide", label: t("guide"), icon: List },
]);
const navItems = computed(() => [
  { key: "overview", label: t("overview"), icon: TrendCharts },
  { key: "reports", label: t("reports"), icon: List },
  { key: "credentials", label: t("credentials"), icon: Key },
  { key: "users", label: t("users"), icon: User },
  { key: "operations", label: t("operations"), icon: Tools },
  { key: "settings", label: t("settings"), icon: Setting },
]);
// 需要运维连接（admin key）的视图；用户区/指南无需连接
const ADMIN_VIEWS = new Set([
  "overview",
  "reports",
  "credentials",
  "users",
  "operations",
  "settings",
]);
const reportBucket = computed(() => (Number(reportWindow.value) > 168 ? "day" : "hour"));
const reportTabs = computed(() => [
  { key: "overview", label: t("reportOverview") },
  { key: "quality", label: t("retrievalQuality") },
  { key: "tokens", label: t("tokenUsage") },
  { key: "inventory", label: t("indexAssets") },
  { key: "storage", label: t("capacityStorage") },
]);
const reportApiBuckets = computed(() => filledBuckets(reports.apiCalls, { count: 0, error_count: 0, avg_latency_ms: 0, p50_latency_ms: 0, p95_latency_ms: 0 }));
const reportRetrievalBuckets = computed(() => filledBuckets(reports.retrieval, { count: 0, empty_count: 0, empty_rate: 0, avg_hit_count: 0, avg_total_ms: 0, p95_total_ms: 0 }));
const reportResourceBuckets = computed(() => reports.resources?.buckets?.length ? filledBuckets(reports.resources, { avg_cpu_percent: 0, max_cpu_percent: 0, avg_mem_percent: 0, max_mem_rss_bytes: 0, disk_data_bytes: 0, disk_free_bytes: 0 }) : []);
const reportTokenKinds = computed(() => {
  const rows = reports.tokens?.buckets || [];
  return [...new Set(rows.map((row) => row.kind).filter(Boolean))];
});
const reportTokenBuckets = computed(() => {
  const report = reports.tokens;
  if (!report) return [];
  const bucket = report.bucket || reportBucket.value;
  const source = Array.isArray(report.buckets) ? report.buckets : [];
  const grouped = new Map();
  source.forEach((row) => {
    const stamp = bucketFloor(row.ts, bucket);
    if (stamp === null) return;
    const item = grouped.get(stamp) || { ts: new Date(stamp).toISOString() };
    item[row.kind] = Number(item[row.kind] || 0) + Number(row.total_tokens || 0);
    grouped.set(stamp, item);
  });
  const step = bucket === "day" ? 24 : 1;
  const count = Math.max(1, Math.ceil(Number(report.window_hours || reportWindow.value) / step));
  const latest = bucketFloor(Date.now(), bucket);
  const filled = Object.fromEntries(reportTokenKinds.value.map((kind) => [kind, 0]));
  return Array.from({ length: count }, (_, index) => {
    const stamp = latest - (count - 1 - index) * step * 3600000;
    return { ts: new Date(stamp).toISOString(), ...filled, ...(grouped.get(stamp) || {}) };
  });
});
const reportStages = computed(() => (reports.retrieval?.stages || []).slice().sort((a, b) => Number(b.avg_ms || 0) - Number(a.avg_ms || 0)));
const reportEndpointRows = computed(() => (reports.apiCalls?.endpoints || []).slice().sort((a, b) => Number(b.p95_latency_ms || 0) - Number(a.p95_latency_ms || 0)));
const reportTokenModels = computed(() => (reports.tokens?.models || []).slice().sort((a, b) => Number(b.total_tokens || 0) - Number(a.total_tokens || 0)));
const reportTokenCredentials = computed(() => (reports.tokens?.credentials || []).slice().sort((a, b) => Number(b.total_tokens || 0) - Number(a.total_tokens || 0)));
const reportMaxStage = computed(() => Math.max(1, ...reportStages.value.map((row) => Number(row.avg_ms || 0))));
const reportMaxStorage = computed(() => Math.max(1, ...((reports.storage?.tables || []).map((row) => Number(row.bytes || 0)))));
const reportDiskClass = computed(() => {
  const days = reports.resources?.disk_days_until_full;
  if (days === null || days === undefined || !Number.isFinite(Number(days))) return "normal";
  if (Number(days) < 7) return "danger";
  if (Number(days) < 30) return "warning";
  return "normal";
});
const kindOptions = computed(() => [
  { value: "embed", label: t("kindEmbed") },
  { value: "rerank", label: t("kindRerank") },
  { value: "llm_rerank", label: t("kindLlmRerank") },
  { value: "query_rewrite", label: t("kindQueryRewrite") },
  { value: "intent", label: t("kindIntent") },
]);
const elementLocale = computed(() => (locale.value === "en" ? en : zhCn));
const currentTitle = computed(
  () =>
    navItems.value.find((item) => item.key === activeView.value)?.label ||
    t("overview"),
);
const activeCredentialCount = computed(
  () => credentials.value.filter((item) => item.status === "active").length,
);
const filteredCredentials = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return credentials.value.filter((item) => {
    const matchesQuery =
      !query ||
      [item.name, item.kind, item.provider, item.model, item.endpoint].some(
        (value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
      );
    return (
      matchesQuery &&
      (statusFilter.value === "all" || item.status === statusFilter.value)
    );
  });
});
const totalQueue = computed(
  () =>
    Number(queue.value?.main_size || 0) +
    Number(queue.value?.inflight || 0) +
    Number(queue.value?.db_pending || 0),
);
const resource = computed(() => stats.value?.resource || null);
const diskPercent = computed(() =>
  resource.value?.disk_total_bytes
    ? Math.max(
        0,
        Math.min(
          100,
          (1 -
            resource.value.disk_free_bytes / resource.value.disk_total_bytes) *
            100,
        ),
      )
    : 0,
);
const tokenRows = computed(() => {
  const rows = stats.value?.tokens || [];
  const total = stats.value?.tokens_total || 0;
  return rows.map((row) => ({
    ...row,
    share: total ? Math.max(2, (row.total_tokens / total) * 100) : 0,
  }));
});
const credentialRules = computed(() => ({
  name: [{ required: true, message: t("required"), trigger: "blur" }],
  kind: [{ required: true, message: t("required"), trigger: "change" }],
  api_key: [
    {
      required: !editingCredential.value,
      message: t("required"),
      trigger: "blur",
    },
  ],
}));
function number(value) {
  return Number(value || 0).toLocaleString(
    locale.value === "en" ? "en-US" : "zh-CN",
  );
}
function compactNumber(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1e9) return `${(amount / 1e9).toFixed(1)}B`;
  if (Math.abs(amount) >= 1e6) return `${(amount / 1e6).toFixed(1)}M`;
  if (Math.abs(amount) >= 1e3) return `${(amount / 1e3).toFixed(1)}K`;
  return number(amount);
}
function bytes(value) {
  const amount = Number(value || 0);
  if (!amount) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const index = Math.min(Math.floor(Math.log(amount) / Math.log(1024)), units.length - 1);
  return `${index ? (amount / 1024 ** index).toFixed(amount / 1024 ** index >= 10 ? 0 : 1) : amount} ${units[index]}`;
}
function pct(value) { return `${(Number(value || 0) * 100).toFixed(1)}%`; }
function bucketFloor(value, bucket) {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return null;
  const dateValue = new Date(parsed);
  return bucket === "day"
    ? Date.UTC(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate())
    : Date.UTC(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate(), dateValue.getUTCHours());
}
function filledBuckets(report, fields = {}) {
  if (!report) return [];
  const bucket = report.bucket || reportBucket.value;
  const step = bucket === "day" ? 24 : 1;
  const count = Math.max(1, Math.ceil(Number(report.window_hours || reportWindow.value) / step));
  const source = Array.isArray(report.buckets) ? report.buckets : [];
  const mapped = new Map(source.map((item) => [bucketFloor(item.ts, bucket), item]));
  const latest = bucketFloor(Date.now(), bucket);
  return Array.from({ length: count }, (_, index) => {
    const stamp = latest - (count - 1 - index) * step * 3600000;
    return { ts: new Date(stamp).toISOString(), ...(fields), ...(mapped.get(stamp) || {}) };
  });
}
function bucketLabel(ts, bucket) {
  const options = bucket === "day"
    ? { month: "short", day: "numeric", timeZone: "UTC" }
    : { hour: "2-digit", minute: "2-digit" };
  const formatted = new Intl.DateTimeFormat(locale.value === "en" ? "en-US" : "zh-CN", options).format(new Date(ts));
  return bucket === "day" ? `${formatted} UTC` : formatted;
}
function stageLabel(stage) { return String(stage || "").replaceAll("_", " "); }
async function loadReports(force = false) {
  if (!api.value) return;
  if (!force && reports.fetched && reports.snapshotAt && Date.now() - reports.snapshotAt < 300000) return;
  const windowHours = Math.min(720, Math.max(1, Number(reportWindow.value) || 24));
  const bucket = reportBucket.value;
  const requests = {
    apiCalls: () => api.value.reportApiCalls(windowHours, bucket),
    retrieval: () => api.value.reportRetrieval(windowHours, bucket),
    slowQueries: () => api.value.reportSlowQueries(windowHours, 50),
    emptyQueries: () => api.value.reportEmptyQueries(windowHours, 50),
    tokens: () => api.value.reportTokens(windowHours, bucket),
    inventory: () => api.value.reportIndexInventory(),
    resources: () => api.value.reportResources(windowHours, bucket),
    storage: () => api.value.reportStorage(),
  };
  await Promise.all(Object.entries(requests).map(async ([key, request]) => {
    reports.loading[key] = true;
    reports.errors[key] = "";
    try { reports[key] = await request(); }
    catch (error) { reports.errors[key] = humanError(error); }
    finally { reports.loading[key] = false; }
  }));
  reports.fetched = true;
  reports.snapshotAt = Date.now();
}
function date(value) {
  if (!value) return t("never");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return t("never");
  return new Intl.DateTimeFormat(locale.value === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}
function time() {
  return new Intl.DateTimeFormat(locale.value === "en" ? "en-US" : "zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}
function host() {
  try {
    return new URL(api.value?.url || settingsForm.url).host;
  } catch {
    return "";
  }
}
function kindLabel(kind) {
  return (
    kindOptions.value.find((item) => item.value === kind)?.label ||
    kind ||
    t("unknown")
  );
}
function record(label) {
  activity.value.unshift({ label, at: time() });
  activity.value = activity.value.slice(0, 12);
}
function humanError(error) {
  if (error?.message === "NETWORK_ERROR")
    return locale.value === "en"
      ? "Cannot reach backend. Check URL, HTTPS, and CORS_ORIGINS."
      : "无法连接后端，请检查地址、HTTPS 和 CORS_ORIGINS 配置。";
  if (error?.status === 401)
    return locale.value === "en" ? "Invalid admin key." : "admin key 无效。";
  return error?.message || t("error");
}
function resetReports() {
  ["apiCalls", "retrieval", "slowQueries", "emptyQueries", "tokens", "inventory", "resources", "storage"].forEach((key) => {
    reports[key] = null;
    reports.loading[key] = false;
    reports.errors[key] = "";
  });
  reports.fetched = false;
  reports.snapshotAt = 0;
}
function loadConnection() {
  const storedUrl = localStorage.getItem(storage.url);
  const storedKey = localStorage.getItem(storage.key);
  const remember = localStorage.getItem(storage.remember) !== "false";
  Object.assign(connectForm, {
    url: storedUrl || DEFAULT_URL,
    key: storedKey || DEFAULT_KEY,
    remember,
  });
  Object.assign(settingsForm, {
    url: storedUrl || DEFAULT_URL,
    key: storedKey || DEFAULT_KEY,
    remember,
  });
  const savedLocale = localStorage.getItem(storage.locale);
  if (savedLocale === "zh" || savedLocale === "en") locale.value = savedLocale;
  return Boolean(storedUrl && storedKey);
}
function saveConnection() {
  if (settingsForm.remember) {
    localStorage.setItem(storage.url, settingsForm.url);
    localStorage.setItem(storage.key, settingsForm.key);
    localStorage.setItem(storage.remember, "true");
  } else
    [storage.url, storage.key, storage.remember].forEach((key) =>
      localStorage.removeItem(key),
    );
}
function setLocale(value) {
  locale.value = value;
  localStorage.setItem(storage.locale, value);
}
async function connect(form = connectForm) {
  connectionError.value = "";
  const url = normalizeUrl(form.url);
  const key = form.key.trim();
  if (!url || !key) return;
  loading.value = true;
  const candidate = new OCEApi(url, key);
  try {
    const [, nextVersion, credentialResponse] = await Promise.all([
      candidate.health(),
      candidate.version(),
      candidate.credentials(),
    ]);
    api.value = candidate;
    resetReports();
    version.value = nextVersion;
    credentials.value = credentialResponse?.credentials || [];
    Object.assign(settingsForm, { url, key, remember: form.remember });
    saveConnection();
    screen.value = "workspace";
    activeView.value = "overview";
    await refreshData();
    ElNotification({
      title: t("connected"),
      message: t("connectedSuccess", { host: host() }),
      type: "success",
      duration: 2600,
    });
  } catch (error) {
    connectionError.value = humanError(error);
  } finally {
    loading.value = false;
  }
}
async function refreshData() {
  if (!api.value) return;
  loadingData.value = true;
  try {
    const [nextStats, nextQueue, nextCredentials] = await Promise.all([
      api.value.stats(),
      api.value.queue(),
      api.value.credentials(),
    ]);
    stats.value = nextStats;
    queue.value = nextQueue;
    credentials.value = nextCredentials?.credentials || [];
  } catch (error) {
    ElMessage.error(humanError(error));
  } finally {
    loadingData.value = false;
  }
}
function disconnect() {
  api.value = null;
  version.value = null;
  stats.value = null;
  queue.value = null;
  credentials.value = [];
  resetReports();
  screen.value = "connect";
}
function changeView(view) {
  if (ADMIN_VIEWS.has(view) && !api.value) {
    // 未连接运维面：回到连接页；取消则留在用户区
    ElMessage.warning(t("adminConnectRequired"));
    screen.value = "connect";
    return;
  }
  activeView.value = view;
  if (view === "reports") loadReports();
}
function enterAsUser() {
  screen.value = "workspace";
  activeView.value = "user";
}
async function sessionLogout() {
  try {
    await logout();
  } catch {
    /* 会话可能已失效 */
  }
  me.value = null;
}
function setForm(item) {
  Object.assign(credentialForm, defaultCredential(), item || {}, {
    api_key: "",
  });
}
function openNewCredential() {
  editingCredential.value = null;
  setForm();
  credentialDialog.value = true;
}
function openEditCredential(item) {
  editingCredential.value = item;
  setForm(item);
  credentialDialog.value = true;
}
function credentialPayload(isUpdate) {
  const payload = {};
  [
    "kind",
    "name",
    "api_key",
    "provider",
    "status",
    "priority",
    "endpoint",
    "model",
    "timeout_seconds",
    "rate_limit",
    "note",
    "dimensions",
    "max_batch_size",
    "max_batch_chars",
    "max_input_chars",
    "input_overlap_chars",
    "top_n",
    "min_score",
    "tpm_limit",
    "max_candidates",
    "output_top_k",
    "snippet_chars",
    "num_rewrites",
  ].forEach((key) => {
    const value = credentialForm[key];
    payload[key] = value === "" ? null : value;
  });
  if (isUpdate && !payload.api_key) delete payload.api_key;
  return payload;
}
async function saveCredential() {
  try {
    await credentialFormRef.value.validate();
  } catch {
    return;
  }
  credentialSubmitting.value = true;
  try {
    if (editingCredential.value)
      await api.value.updateCredential(
        editingCredential.value.id,
        credentialPayload(true),
      );
    else await api.value.createCredential(credentialPayload(false));
    credentialDialog.value = false;
    await refreshData();
    record(editingCredential.value ? t("updated") : t("created"));
    ElMessage.success(editingCredential.value ? t("updated") : t("created"));
  } catch (error) {
    ElMessage.error(humanError(error));
  } finally {
    credentialSubmitting.value = false;
  }
}
function openDuplicate(item) {
  duplicateSourceKind.value = item.kind || "";
  Object.assign(duplicateForm, {
    ...defaultDuplicate(),
    id: item.id,
    name: t("copyName", { name: item.name }),
  });
  duplicateDialog.value = true;
}
function duplicatePayload() {
  const payload = {};
  const commonFields = [
    "name",
    "api_key",
    "kind",
    "provider",
    "status",
    "priority",
    "endpoint",
    "model",
    "timeout_seconds",
    "rate_limit",
    "note",
  ];
  const kindFields = {
    embed: [
      "dimensions",
      "max_batch_size",
      "max_batch_chars",
      "max_input_chars",
      "input_overlap_chars",
    ],
    rerank: ["top_n", "min_score", "tpm_limit"],
    llm_rerank: ["max_candidates", "output_top_k", "snippet_chars"],
    query_rewrite: ["num_rewrites"],
  };
  [...commonFields, ...(kindFields[duplicateEffectiveKind.value] || [])].forEach(
    (key) => {
      const value = duplicateForm[key];
      if (value !== "" && value !== null && value !== undefined)
        payload[key] = value;
    },
  );
  return payload;
}
async function duplicateCredential() {
  duplicateSubmitting.value = true;
  try {
    const payload = duplicatePayload();
    if (typeof payload.name === "string") payload.name = payload.name.trim();
    if (!payload.name) delete payload.name;
    await api.value.duplicateCredential(duplicateForm.id, payload);
    duplicateDialog.value = false;
    await refreshData();
    record(t("copied"));
    ElMessage.success(t("copied"));
  } catch (error) {
    ElMessage.error(humanError(error));
  } finally {
    duplicateSubmitting.value = false;
  }
}
async function removeCredential(item) {
  try {
    await ElMessageBox.confirm(
      t("confirmDelete", { name: item.name }),
      t("confirm"),
      {
        type: "warning",
        confirmButtonText: t("remove"),
        cancelButtonText: t("cancel"),
      },
    );
    await api.value.deleteCredential(item.id);
    await refreshData();
    record(`${t("deleted")} · ${item.name}`);
    ElMessage.success(t("deleted"));
  } catch (error) {
    if (error !== "cancel" && error !== "close")
      ElMessage.error(humanError(error));
  }
}
async function reloadCredentials() {
  operationLoading.reload = true;
  try {
    const result = await api.value.reloadCredentials();
    await refreshData();
    record(t("refreshed"));
    ElMessage.success(`${t("refreshed")} · ${result.pool_size || 0}`);
  } catch (error) {
    ElMessage.error(humanError(error));
  } finally {
    operationLoading.reload = false;
  }
}
async function resetQueue() {
  try {
    await ElMessageBox.confirm(t("confirmReset"), t("confirm"), {
      type: "warning",
      confirmButtonText: t("resetQueue"),
      cancelButtonText: t("cancel"),
    });
    operationLoading.reset = true;
    const result = await api.value.resetQueue({
      mode: queueForm.mode,
      requeue: queueForm.requeue,
    });
    await refreshData();
    record(t("resetQueue"));
    ElMessage.success(t("queueResetDone", { count: result.requeued || 0 }));
  } catch (error) {
    if (error !== "cancel" && error !== "close")
      ElMessage.error(humanError(error));
  } finally {
    operationLoading.reset = false;
  }
}
async function requeueStale() {
  operationLoading.stale = true;
  try {
    const result = await api.value.requeueStale({
      stale_hours: Number(staleForm.stale_hours),
      limit: Number(staleForm.limit),
    });
    await refreshData();
    record(t("requeueStale"));
    ElMessage.success(t("queued", { count: result.requeued_count || 0 }));
  } catch (error) {
    ElMessage.error(humanError(error));
  } finally {
    operationLoading.stale = false;
  }
}
async function runGc() {
  const execute = async () => {
    operationLoading.gc = true;
    try {
      gcResult.value = await api.value.gc({
        ttl_days: Number(gcForm.ttl_days),
        dry_run: gcForm.dry_run,
        limit: Number(gcForm.limit),
      });
      record(gcForm.dry_run ? t("gcPreviewDone") : t("gcDone"));
      ElMessage.success(gcForm.dry_run ? t("gcPreviewDone") : t("gcDone"));
    } catch (error) {
      ElMessage.error(humanError(error));
    } finally {
      operationLoading.gc = false;
    }
  };
  if (gcForm.dry_run) return execute();
  try {
    await ElMessageBox.confirm(t("confirmGc"), t("confirm"), {
      type: "warning",
      confirmButtonText: t("runGc"),
      cancelButtonText: t("cancel"),
    });
    await execute();
  } catch (error) {
    if (error !== "cancel" && error !== "close")
      ElMessage.error(humanError(error));
  }
}
async function saveSettings() {
  await connect(settingsForm);
}
function clearLocal() {
  [storage.url, storage.key, storage.remember].forEach((key) =>
    localStorage.removeItem(key),
  );
  Object.assign(connectForm, {
    url: DEFAULT_URL,
    key: DEFAULT_KEY,
    remember: true,
  });
  Object.assign(settingsForm, {
    url: DEFAULT_URL,
    key: DEFAULT_KEY,
    remember: true,
  });
  disconnect();
}
async function loadSession() {
  try {
    me.value = await fetchMe();
  } catch {
    me.value = null;
  } finally {
    sessionReady.value = true;
  }
}
onMounted(() => {
  loadSession();
  if (loadConnection()) connect(connectForm);
});
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <main v-if="screen === 'connect'" class="connect-page">
      <div class="connect-shell">
        <div class="brand brand-large">
          <img :src="logoUrl" alt="" /><span>OCE <em>Portal</em></span>
        </div>
        <el-card class="connect-card" shadow="never"
          ><div class="overline">{{ $t("controlPlane") }} / 01</div>
          <h1>{{ $t("connect") }}<br /><span>OpenContextEngine</span></h1>
          <p class="connect-lede">{{ $t("instanceHealth") }}</p>
          <el-form
            :model="connectForm"
            label-position="top"
            @submit.prevent="connect()"
            ><el-form-item :label="$t('backendUrl')" required
              ><el-input
                v-model="connectForm.url"
                type="url"
                placeholder="http://127.0.0.1:8986"
                size="large"
              />
              <div class="field-help">{{ $t("urlHint") }}</div></el-form-item
            ><el-form-item :label="$t('adminKey')" required
              ><el-input
                v-model="connectForm.key"
                :type="showConnectKey ? 'text' : 'password'"
                placeholder="sk-opencontextengine"
                size="large"
                ><template #suffix
                  ><el-button link @click="showConnectKey = !showConnectKey">{{
                    showConnectKey ? $t("hide") : $t("show")
                  }}</el-button></template
                ></el-input
              ></el-form-item
            ><el-checkbox v-model="connectForm.remember">{{
              $t("remember")
            }}</el-checkbox
            ><el-button
              class="connect-button"
              type="primary"
              native-type="submit"
              size="large"
              :loading="loading"
              :icon="Connection"
              >{{ loading ? $t("connecting") : $t("connect") }}</el-button
            ><el-button
              class="connect-button connect-secondary"
              size="large"
              text
              @click="enterAsUser"
              >{{ $t("enterAsUser") }}</el-button
            ><el-alert
              v-if="connectionError"
              class="connect-error"
              :title="connectionError"
              type="error"
              :closable="false"
              show-icon
          /></el-form>
          <div class="connect-foot">
            <el-icon><Lock /></el-icon>{{ $t("keyHint") }}
          </div></el-card
        >
        <div class="connect-meta">
          <span>OpenContextEngine</span><span>·</span
          ><span>{{ $t("staticDeploy") }}</span>
        </div>
      </div>
    </main>
    <el-container v-else class="app-shell"
      ><el-aside class="app-aside" width="238px"
        ><div class="aside-top">
          <div class="brand">
            <img :src="logoUrl" alt="" /><span>OCE <em>Portal</em></span>
          </div>
          <el-tag class="instance-tag" type="success" effect="dark"
            ><span class="pulse-dot"></span>{{ host() }}</el-tag
          >
        </div>
        <el-menu
          class="app-menu"
          :default-active="activeView"
          @select="changeView"
          ><div class="menu-caption">{{ $t("userCenter") }}</div>
          <el-menu-item
            v-for="(item, index) in userNavItems"
            :key="item.key"
            :index="item.key"
            ><el-icon><component :is="item.icon" /></el-icon
            ><span>{{ item.label }}</span
            ><small>0{{ index + 1 }}</small></el-menu-item
          >
          <div class="menu-caption menu-caption-spaced">
            {{ $t("workspace") }}{{ api ? "" : ` (${$t("notConnected")})` }}
          </div>
          <el-menu-item
            v-for="(item, index) in navItems.slice(0, 5)"
            :key="item.key"
            :index="item.key"
            ><el-icon><component :is="item.icon" /></el-icon
            ><span>{{ item.label }}</span
            ><small>0{{ index + 3 }}</small></el-menu-item
          >
          <div class="menu-caption menu-caption-spaced">
            {{ $t("instance") }}
          </div>
          <el-menu-item :index="navItems[5].key"
            ><el-icon><component :is="navItems[5].icon" /></el-icon
            ><span>{{ navItems[5].label }}</span
            ><small>08</small></el-menu-item
          ></el-menu
        >
        <div class="aside-bottom">
          <div v-if="api" class="api-status">
            <span class="pulse-dot"></span>
            <div>
              <strong>{{ $t("connected") }}</strong
              ><small>OCE {{ version?.version || "--" }}</small>
            </div>
          </div>
          <div v-else class="api-status">
            <div>
              <strong class="muted">{{ $t("notConnected") }}</strong
              ><small class="muted">{{ $t("adminHint") }}</small>
            </div>
          </div>
          <el-button
            v-if="api"
            class="disconnect-button"
            text
            :icon="SwitchButton"
            @click="disconnect"
            >{{ $t("disconnect") }}</el-button
          >
          <el-button
            v-else
            class="disconnect-button"
            text
            :icon="Connection"
            @click="screen = 'connect'"
            >{{ $t("connect") }}</el-button
          >
        </div></el-aside
      ><el-container class="content-shell"
        ><el-header class="topbar"
          ><div class="breadcrumb">
            <span>OCE Portal</span><el-icon><ArrowRight /></el-icon
            ><strong>{{ currentTitle }}</strong>
          </div>
          <div class="top-actions">
            <span class="sync-label">{{
              loadingData ? $t("syncing") : $t("syncAt", { time: time() })
            }}</span
            ><el-button
              circle
              :icon="Refresh"
              :loading="loadingData"
              :aria-label="$t('refresh')"
              @click="refreshData"
            /><el-dropdown @command="setLocale"
              ><el-button circle
                ><span class="locale-code">{{
                  locale.toUpperCase()
                }}</span></el-button
              ><template #dropdown
                ><el-dropdown-menu
                  ><el-dropdown-item command="zh">简体中文</el-dropdown-item
                  ><el-dropdown-item command="en"
                    >English</el-dropdown-item
                  ></el-dropdown-menu
                ></template
              ></el-dropdown
            ><el-button
              v-if="!me"
              tag="a"
              :href="loginUrl()"
              size="small"
              type="primary"
              plain
              >{{ $t("loginWithLinuxDo") }}</el-button
            ><el-dropdown v-else @command="sessionLogout"
              ><el-avatar
                class="admin-avatar"
                :size="32"
                :aria-label="me.user.username"
                >{{ (me.user.name || me.user.username).slice(0, 1).toUpperCase() }}</el-avatar
              ><template #dropdown
                ><el-dropdown-menu
                  ><el-dropdown-item command="logout"
                    ><el-icon><SwitchButton /></el-icon
                    >{{ $t("logout") }}（@{{ me.user.username }}）</el-dropdown-item
                  ></el-dropdown-menu
                ></template
              ></el-dropdown
            >
          </div></el-header
        ><el-main class="main-area"
          ><h1 class="sr-only">OCE Portal</h1>
          <UserView v-show="activeView === 'user'" />
          <GuideView v-show="activeView === 'guide'" />
          <UsersAdminView v-show="activeView === 'users'" :api="api" />
          <section v-show="activeView === 'overview'" class="view-section">
            <div class="page-heading">
              <div>
                <div class="overline">{{ $t("systemPulse") }} / 24H</div>
                <h2>{{ $t("overview") }}</h2>
                <p>{{ $t("instanceHealth") }}</p>
              </div>
              <el-button
                type="primary"
                plain
                :icon="Refresh"
                :loading="loadingData"
                @click="refreshData"
                >{{ $t("refreshStatus") }}</el-button
              >
            </div>
            <el-row :gutter="14" class="metric-row"
              ><el-col :xs="12" :sm="6"
                ><el-card class="metric-card accent" shadow="never"
                  ><el-statistic
                    :title="$t('apiCalls')"
                    :value="stats?.api_calls?.count || 0"
                  />
                  <div class="metric-foot">
                    <span
                      >{{ number(stats?.api_calls?.error_count) }}
                      {{ $t("errors") }}</span
                    ><b
                      >{{
                        Number(stats?.api_calls?.avg_latency_ms || 0).toFixed(
                          1,
                        )
                      }}ms {{ $t("avg") }}</b
                    >
                  </div></el-card
                ></el-col
              ><el-col :xs="12" :sm="6"
                ><el-card class="metric-card" shadow="never"
                  ><el-statistic
                    :title="$t('retrievalRequests')"
                    :value="stats?.retrieval?.count || 0"
                  />
                  <div class="metric-foot">
                    <span
                      >{{
                        ((stats?.retrieval?.empty_rate || 0) * 100).toFixed(1)
                      }}% {{ $t("emptyRate") }}</span
                    ><span>{{ $t("last24h") }}</span>
                  </div></el-card
                ></el-col
              ><el-col :xs="12" :sm="6"
                ><el-card class="metric-card" shadow="never"
                  ><el-statistic
                    :title="$t('tokens')"
                    :value="stats?.tokens_total || 0"
                    group-separator=","
                  />
                  <div class="metric-foot">
                    <span
                      >{{ (stats?.tokens || []).length }}
                      {{ $t("categories") }}</span
                    ><span>{{ $t("last24h") }}</span>
                  </div></el-card
                ></el-col
              ><el-col :xs="12" :sm="6"
                ><el-card class="metric-card" shadow="never"
                  ><el-statistic
                    :title="$t('queuePending')"
                    :value="totalQueue"
                  />
                  <div class="metric-foot">
                    <span>{{
                      queue?.enabled
                        ? $t("workerEnabled")
                        : $t("workerDisabled")
                    }}</span
                    ><span>{{ $t("dbPending") }}</span>
                  </div></el-card
                ></el-col
              ></el-row
            ><el-row :gutter="14"
              ><el-col :xs="24" :lg="15"
                ><el-card class="panel-card runtime-card" shadow="never"
                  ><template #header
                    ><div class="panel-header">
                      <div>
                        <div class="overline">{{ $t("runtime") }}</div>
                        <h3>{{ $t("instanceStatus") }}</h3>
                      </div>
                      <el-tag type="success" effect="plain">{{
                        $t("online")
                      }}</el-tag>
                    </div></template
                  ><el-row :gutter="16"
                    ><el-col :span="6"
                      ><div class="runtime-stat">
                        <span>{{ $t("service") }}</span
                        ><strong>{{ $t("online") }}</strong
                        ><small>v{{ version?.version || "--" }}</small>
                      </div></el-col
                    ><el-col :span="6"
                      ><div class="runtime-stat">
                        <span>{{ $t("worker") }}</span
                        ><strong>{{
                          queue?.enabled ? $t("online") : $t("offline")
                        }}</strong
                        ><small
                          >{{ number(queue?.main_size) }}
                          {{ $t("mainQueue") }}</small
                        >
                      </div></el-col
                    ><el-col :span="6"
                      ><div class="runtime-stat">
                        <span>{{ $t("credentialsPool") }}</span
                        ><strong>{{ number(activeCredentialCount) }}</strong
                        ><small>{{ $t("activeRows") }}</small>
                      </div></el-col
                    ><el-col :span="6"
                      ><div class="runtime-stat">
                        <span>{{ $t("lastCheck") }}</span
                        ><strong>{{ time() }}</strong
                        ><small>{{
                          $t("httpVersion", { version: version?.version || "--" })
                        }}</small>
                      </div></el-col
                    ></el-row
                  >
                  <div class="endpoint-line">
                    <span class="pulse-dot"></span><code>{{ api?.url }}</code
                    ><span>{{ $t("authenticated") }}</span>
                  </div></el-card
                ></el-col
              ><el-col :xs="24" :lg="9"
                ><el-card class="panel-card" shadow="never"
                  ><template #header
                    ><div class="panel-header">
                      <div>
                        <div class="overline">{{ $t("resource") }}</div>
                        <h3>{{ $t("resource") }}</h3>
                      </div>
                      <el-icon class="panel-icon"><Monitor /></el-icon></div
                  ></template>
                  <div class="resource-list">
                    <div>
                      <div class="resource-label">
                        <span>{{ $t("memory") }}</span
                        ><b
                          >{{
                            Number(resource?.mem_percent || 0).toFixed(1)
                          }}%</b
                        >
                      </div>
                      <el-progress
                        :aria-label="$t('memory')"
                        :percentage="Math.min(resource?.mem_percent || 0, 100)"
                        :show-text="false"
                        :stroke-width="7"
                      />
                    </div>
                    <div>
                      <div class="resource-label">
                        <span>{{ $t("cpu") }}</span
                        ><b
                          >{{
                            Number(resource?.cpu_percent || 0).toFixed(1)
                          }}%</b
                        >
                      </div>
                      <el-progress
                        :aria-label="$t('cpu')"
                        status="exception"
                        :percentage="Math.min(resource?.cpu_percent || 0, 100)"
                        :show-text="false"
                        :stroke-width="7"
                      />
                    </div>
                    <div>
                      <div class="resource-label">
                        <span>{{ $t("disk") }}</span
                        ><b>{{ diskPercent.toFixed(1) }}%</b>
                      </div>
                      <el-progress
                        :aria-label="$t('disk')"
                        :percentage="diskPercent"
                        :show-text="false"
                        :stroke-width="7"
                      />
                    </div>
                  </div>
                  <div class="panel-foot">
                    {{
                      resource?.ts
                        ? `${$t("sampled")} ${date(resource.ts)}`
                        : $t("noData")
                    }}
                  </div></el-card
                ></el-col
              ></el-row
            ><el-row :gutter="14"
              ><el-col :xs="24" :lg="15"
                ><el-card class="panel-card" shadow="never"
                  ><template #header
                    ><div class="panel-header">
                      <div>
                        <div class="overline">{{ $t("usageMix") }}</div>
                        <h3>{{ $t("tokenUsage") }}</h3>
                      </div>
                      <span class="muted"
                        >{{ $t("total") }}
                        {{ number(stats?.tokens_total) }}</span
                      >
                    </div></template
                  ><el-empty
                    v-if="!tokenRows.length"
                    :description="$t('noData')"
                    :image-size="55" />
                  <div v-else class="token-list">
                    <div
                      v-for="row in tokenRows"
                      :key="row.kind"
                      class="token-row"
                    >
                      <span>{{ kindLabel(row.kind) }}</span
                      ><b>{{ number(row.total_tokens) }}</b
                      ><el-progress
                        :aria-label="`${kindLabel(row.kind)} ${$t('tokens')}`"
                        :percentage="row.share"
                        :show-text="false"
                        :stroke-width="7"
                      />
                    </div></div></el-card></el-col
              ><el-col :xs="24" :lg="9"
                ><el-card class="panel-card" shadow="never"
                  ><template #header
                    ><div class="panel-header">
                      <div>
                        <div class="overline">{{ $t("queue") }}</div>
                        <h3>{{ $t("queue") }}</h3>
                      </div>
                      <el-button
                        link
                        type="primary"
                        @click="activeView = 'operations'"
                        >{{ $t("manage") }} <el-icon><ArrowRight /></el-icon
                      ></el-button></div></template
                  ><el-row :gutter="12" class="queue-summary"
                    ><el-col :span="8"
                      ><span>{{ $t("mainQueue") }}</span
                      ><b>{{ number(queue?.main_size) }}</b></el-col
                    ><el-col :span="8"
                      ><span>{{ $t("inflight") }}</span
                      ><b>{{ number(queue?.inflight) }}</b></el-col
                    ><el-col :span="8"
                      ><span>{{ $t("dbPending") }}</span
                      ><b>{{ number(queue?.db_pending) }}</b></el-col
                    ></el-row
                  ><el-progress
                    :aria-label="$t('queuePending')"
                    :percentage="totalQueue ? 100 : 0"
                    status="exception"
                    :show-text="false"
                    :stroke-width="7"
                  />
                  <div class="panel-foot">
                    {{
                      queue?.enabled
                        ? $t("workerEnabled")
                        : $t("workerDisabled")
                    }}
                  </div></el-card
                ></el-col
              ></el-row
            >
          </section>
          <ReportsView
            v-if="activeView === 'reports'"
            v-model:active-tab="activeReportTab"
            v-model:window-hours="reportWindow"
            :reports="reports"
            :bucket="reportBucket"
            :api-buckets="reportApiBuckets"
            :retrieval-buckets="reportRetrievalBuckets"
            :resource-buckets="reportResourceBuckets"
            :token-buckets="reportTokenBuckets"
            :token-kinds="reportTokenKinds"
            :stages="reportStages"
            :endpoint-rows="reportEndpointRows"
            :token-models="reportTokenModels"
            :token-credentials="reportTokenCredentials"
            :max-stage="reportMaxStage"
            :max-storage="reportMaxStorage"
            :disk-class="reportDiskClass"
            @refresh="loadReports"
          />
          <section v-show="activeView === 'credentials'" class="view-section">
            <div class="page-heading">
              <div>
                <div class="overline">
                  {{ $t("providerAccess") }} / {{ credentials.length }}
                  {{ $t("rows") }}
                </div>
                <h2>{{ $t("credentials") }}</h2>
                <p>{{ $t("providerDescription") }}</p>
              </div>
              <div class="heading-actions">
                <el-button
                  plain
                  :icon="RefreshLeft"
                  :loading="operationLoading.reload"
                  @click="reloadCredentials"
                  >{{ $t("reload") }}</el-button
                ><el-button
                  type="primary"
                  :icon="Plus"
                  @click="openNewCredential"
                  >{{ $t("addCredential") }}</el-button
                >
              </div>
            </div>
            <el-card class="table-card" shadow="never"
              ><div class="table-toolbar">
                <el-input
                  v-model="searchQuery"
                  :placeholder="$t('searchCredentials')"
                  :prefix-icon="Search"
                  clearable
                /><el-select
                  v-model="statusFilter"
                  :placeholder="$t('status')"
                  style="width: 145px"
                  ><el-option value="all" :label="$t('allStatus')" /><el-option
                    value="active"
                    :label="$t('active')" /><el-option
                    value="disabled"
                    :label="$t('disabled')" /></el-select
                ><span class="toolbar-spacer"></span
                ><span class="muted"
                  >{{ filteredCredentials.length }} {{ $t("matching") }}</span
                >
              </div>
              <el-table
                v-if="filteredCredentials.length"
                :data="filteredCredentials"
                row-key="id"
                stripe
                ><el-table-column :label="$t('name')" min-width="190"
                  ><template #default="{ row }"
                    ><div class="credential-name">
                      <el-avatar shape="square" :size="34">{{
                        row.name?.slice(0, 1).toUpperCase()
                      }}</el-avatar>
                      <div>
                        <strong>{{ row.name }}</strong
                        ><small
                          >{{ kindLabel(row.kind) }} · {{ $t("keyLabel") }} ••••{{
                            row.api_key_last4
                          }}</small
                        >
                      </div>
                    </div></template
                  ></el-table-column
                ><el-table-column :label="$t('provider')" min-width="220"
                  ><template #default="{ row }"
                    ><strong>{{ row.provider || $t("customProvider") }}</strong
                    ><small class="table-subtext">{{
                      row.model || $t("modelNotSet")
                    }}</small
                    ><small v-if="row.endpoint" class="table-subtext">{{
                      row.endpoint
                    }}</small></template
                  ></el-table-column
                ><el-table-column :label="$t('status')" width="120"
                  ><template #default="{ row }"
                    ><el-tag
                      :type="row.status === 'active' ? 'success' : 'info'"
                      effect="light"
                      >{{
                        row.status === "active" ? $t("active") : $t("disabled")
                      }}</el-tag
                    ></template
                  ></el-table-column
                ><el-table-column
                  prop="priority"
                  :label="$t('priority')"
                  width="100" /><el-table-column
                  :label="$t('config')"
                  width="150"
                  ><template #default="{ row }"
                    ><span
                      >{{ row.timeout_seconds }}s<span v-if="row.dimensions">
                        · {{ row.dimensions }}d</span
                      ></span
                    ></template
                  ></el-table-column
                ><el-table-column :label="$t('updatedAt')" width="145"
                  ><template #default="{ row }"
                    ><span class="muted">{{
                      date(row.updated_at || row.last_used_at)
                    }}</span></template
                  ></el-table-column
                ><el-table-column
                  :label="$t('actions')"
                  width="176"
                  fixed="right"
                  ><template #default="{ row }"
                    ><div class="credential-actions">
                      <el-button
                        text
                        circle
                        :icon="EditPen"
                        :aria-label="$t('edit')"
                        @click="openEditCredential(row)" /><el-button
                        text
                        circle
                        :icon="CopyDocument"
                        :aria-label="$t('duplicate')"
                        @click="openDuplicate(row)" /><el-button
                        text
                        circle
                        type="danger"
                        :icon="Delete"
                        :aria-label="$t('remove')"
                        @click="removeCredential(row)"
                      />
                    </div></template></el-table-column></el-table
              ><el-empty
                v-else
                :description="
                  credentials.length ? $t('noData') : $t('noCredentials')
                "
                :image-size="80"
                ><el-button
                  type="primary"
                  :icon="Plus"
                  @click="openNewCredential"
                  >{{ $t("addCredential") }}</el-button
                ></el-empty
              ></el-card
            >
          </section>
          <section v-show="activeView === 'operations'" class="view-section">
            <div class="page-heading">
              <div>
                <div class="overline">{{ $t("maintenance") }}</div>
                <h2>{{ $t("operations") }}</h2>
                <p>{{ $t("operationsHint") }}</p>
              </div>
              <el-tag type="warning" effect="light"
                ><el-icon><Warning /></el-icon>{{ $t("caution") }}</el-tag
              >
            </div>
            <el-row :gutter="14"
              ><el-col :xs="24" :lg="12"
                ><el-card class="panel-card operation-card" shadow="never"
                  ><template #header
                    ><div class="panel-header">
                      <div>
                        <div class="overline">{{ $t("workerQueue") }}</div>
                        <h3>{{ $t("queueManagement") }}</h3>
                      </div>
                      <el-icon class="panel-icon"
                        ><List
                      /></el-icon></div></template
                  ><el-row :gutter="15" class="operation-stats"
                    ><el-col :span="8"
                      ><span>{{ $t("mainQueue") }}</span
                      ><b>{{ number(queue?.main_size) }}</b></el-col
                    ><el-col :span="8"
                      ><span>{{ $t("inflight") }}</span
                      ><b>{{ number(queue?.inflight) }}</b></el-col
                    ><el-col :span="8"
                      ><span>{{ $t("dbPending") }}</span
                      ><b>{{ number(queue?.db_pending) }}</b></el-col
                    ></el-row
                  ><el-divider /><el-form label-position="top"
                    ><el-form-item :label="$t('resetMode')"
                      ><el-select v-model="queueForm.mode"
                        ><el-option
                          value="sync"
                          :label="$t('sync')" /><el-option
                          value="purge"
                          :label="$t('purge')" /></el-select></el-form-item
                    ><el-checkbox v-model="queueForm.requeue">{{
                      $t("requeuePending")
                    }}</el-checkbox
                    ><el-button
                      class="form-action"
                      type="danger"
                      plain
                      :loading="operationLoading.reset"
                      :icon="RefreshLeft"
                      @click="resetQueue"
                      >{{ $t("resetQueue") }}</el-button
                    ><el-divider /><el-row :gutter="10"
                      ><el-col :span="9"
                        ><el-form-item :label="$t('staleHours')"
                          ><el-input-number
                            v-model="staleForm.stale_hours"
                            :min="1"
                            :max="8760"
                            controls-position="right" /></el-form-item></el-col
                      ><el-col :span="9"
                        ><el-form-item :label="$t('limit')"
                          ><el-input-number
                            v-model="staleForm.limit"
                            :min="1"
                            :max="10000"
                            controls-position="right" /></el-form-item></el-col
                      ><el-col :span="6" class="action-col"
                        ><el-button
                          type="primary"
                          plain
                          :loading="operationLoading.stale"
                          :icon="Clock"
                          @click="requeueStale"
                          >{{ $t("requeueStale") }}</el-button
                        ></el-col
                      ></el-row
                    ></el-form
                  ></el-card
                ></el-col
              ><el-col :xs="24" :lg="12"
                ><el-card class="panel-card operation-card" shadow="never"
                  ><template #header
                    ><div class="panel-header">
                      <div>
                        <div class="overline">{{ $t("storageLifecycle") }}</div>
                        <h3>{{ $t("garbageCollection") }}</h3>
                      </div>
                      <el-icon class="panel-icon"><Archive /></el-icon></div
                  ></template>
                  <p class="operation-intro">{{ $t("gcHint") }}</p>
                  <el-form label-position="top"
                    ><el-row :gutter="10"
                      ><el-col :span="12"
                        ><el-form-item :label="$t('ttlDays')"
                          ><el-input-number
                            v-model="gcForm.ttl_days"
                            :min="1"
                            :max="3650"
                            controls-position="right" /></el-form-item></el-col
                      ><el-col :span="12"
                        ><el-form-item :label="$t('limit')"
                          ><el-input-number
                            v-model="gcForm.limit"
                            :min="1"
                            :max="100000"
                            controls-position="right" /></el-form-item></el-col></el-row
                    ><el-checkbox v-model="gcForm.dry_run">{{
                      $t("dryRun")
                    }}</el-checkbox
                    ><el-button
                      class="form-action"
                      type="primary"
                      :loading="operationLoading.gc"
                      :icon="gcForm.dry_run ? Search : Delete"
                      @click="runGc"
                      >{{ $t("runGc") }}</el-button
                    ></el-form
                  ><el-alert
                    v-if="gcResult"
                    class="gc-result"
                    type="success"
                    :closable="false"
                    show-icon
                    ><template #title>{{
                      gcResult.dry_run ? $t("previewDone") : $t("cleanupDone")
                    }}</template>
                    <div>
                      {{
                        $t("gcExpiredChains", {
                          count: gcResult.expired_chains || 0,
                        })
                      }}
                      ·
                      {{
                        $t("gcExpiredBlobs", {
                          count: gcResult.expired_blobs || 0,
                        })
                      }}
                      ·
                      {{
                        gcResult.dry_run
                          ? $t("gcDeletableBlobs", {
                              count: gcResult.deletable_blobs || 0,
                            })
                          : $t("gcDeletedBlobs", {
                              count: gcResult.deleted_blobs || 0,
                            })
                      }}
                      ·
                      {{
                        $t("gcSkippedInflight", {
                          count: gcResult.skipped_inflight || 0,
                        })
                      }}
                    </div></el-alert
                  ></el-card
                ></el-col
              ></el-row
            ><el-card class="panel-card activity-card" shadow="never"
              ><template #header
                ><div class="panel-header">
                  <div>
                    <div class="overline">{{ $t("activity") }}</div>
                    <h3>{{ $t("sessionActivity") }}</h3>
                  </div>
                  <el-button link @click="activity = []">{{
                    $t("clear")
                  }}</el-button>
                </div></template
              ><el-empty
                v-if="!activity.length"
                :description="$t('noActivity')"
                :image-size="55"
              /><el-timeline v-else
                ><el-timeline-item
                  v-for="item in activity"
                  :key="`${item.at}-${item.label}`"
                  :timestamp="item.at"
                  type="success"
                  ><strong>{{ item.label }}</strong></el-timeline-item
                ></el-timeline
              ></el-card
            >
          </section>
          <section v-show="activeView === 'settings'" class="view-section">
            <div class="page-heading">
              <div>
                <div class="overline">{{ $t("instanceConnection") }}</div>
                <h2>{{ $t("settings") }}</h2>
                <p>{{ $t("connectionInfo") }}</p>
              </div>
            </div>
            <el-row :gutter="14"
              ><el-col :xs="24" :lg="12"
                ><el-card class="panel-card settings-card" shadow="never"
                  ><template #header
                    ><div class="panel-header">
                      <div>
                        <div class="overline">{{ $t("connection") }}</div>
                        <h3>{{ $t("connection") }}</h3>
                      </div>
                      <el-tag type="success" effect="plain">{{
                        $t("connected")
                      }}</el-tag>
                    </div></template
                  ><el-form label-position="top"
                    ><el-form-item :label="$t('backendUrl')"
                      ><el-input
                        v-model="settingsForm.url"
                        type="url" /></el-form-item
                    ><el-form-item :label="$t('adminKey')"
                      ><el-input
                        v-model="settingsForm.key"
                        :type="showSettingsKey ? 'text' : 'password'"
                        ><template #suffix
                          ><el-button
                            link
                            @click="showSettingsKey = !showSettingsKey"
                            >{{
                              showSettingsKey ? $t("hide") : $t("show")
                            }}</el-button
                          ></template
                        ></el-input
                      ></el-form-item
                    ><el-checkbox v-model="settingsForm.remember">{{
                      $t("remember")
                    }}</el-checkbox>
                    <div class="form-actions">
                      <el-button
                        type="primary"
                        :icon="Connection"
                        @click="saveSettings"
                        >{{ $t("saveReconnect") }}</el-button
                      ><el-button plain :icon="Delete" @click="clearLocal">{{
                        $t("clearLocal")
                      }}</el-button>
                    </div></el-form
                  ></el-card
                ></el-col
              ><el-col :xs="24" :lg="12"
                ><el-card class="panel-card settings-card" shadow="never"
                  ><template #header
                    ><div class="panel-header">
                      <div>
                        <div class="overline">{{ $t("security") }}</div>
                        <h3>{{ $t("browserSecurity") }}</h3>
                      </div>
                      <el-icon class="panel-icon"
                        ><Lock
                      /></el-icon></div></template
                  ><el-alert
                    v-for="item in [
                      'security1',
                      'security2',
                      'security3',
                      'security4',
                    ]"
                    :key="item"
                    :title="$t(item)"
                    :type="item === 'security4' ? 'warning' : 'success'"
                    :closable="false"
                    show-icon
                    class="security-alert"
                  />
                  <div class="origin-box">
                    <span>{{ $t("pageOrigin") }}</span
                    ><code>{{ pageOrigin }}</code>
                  </div></el-card
                ></el-col
              ></el-row
            >
          </section>
        </el-main></el-container
      ></el-container
    >
    <el-dialog
      v-model="credentialDialog"
      :title="editingCredential ? $t('editCredential') : $t('addCredential')"
      width="min(760px, calc(100vw - 30px))"
      destroy-on-close
      ><el-form
        ref="credentialFormRef"
        :model="credentialForm"
        :rules="credentialRules"
        label-position="top"
        class="credential-form"
        ><el-divider content-position="left">{{ $t("identity") }}</el-divider
        ><el-row :gutter="14"
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('name')" prop="name"
              ><el-input v-model="credentialForm.name" /></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('kind')" prop="kind"
              ><el-select v-model="credentialForm.kind"
                ><el-option
                  v-for="option in kindOptions"
                  :key="option.value"
                  :value="option.value"
                  :label="option.label" /></el-select></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('provider')"
              ><el-input
                v-model="credentialForm.provider"
                placeholder="siliconflow" /></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('status')"
              ><el-select v-model="credentialForm.status"
                ><el-option value="active" :label="$t('active')" /><el-option
                  value="disabled"
                  :label="$t('disabled')" /></el-select></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('priority')"
              ><el-input-number
                v-model="credentialForm.priority"
                :min="0"
                :max="100000"
                controls-position="right" /></el-form-item></el-col></el-row
        ><el-divider content-position="left">{{
          $t("connectionConfig")
        }}</el-divider
        ><el-row :gutter="14"
          ><el-col :span="24"
            ><el-form-item :label="$t('apiKey')" prop="api_key"
              ><el-input
                v-model="credentialForm.api_key"
                type="password"
                show-password
                :placeholder="
                  editingCredential ? $t('apiKeyHintEdit') : $t('apiKeyHintNew')
                " /></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('endpoint')"
              ><el-input
                v-model="credentialForm.endpoint"
                placeholder="https://api.example.com" /></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('model')"
              ><el-input
                v-model="credentialForm.model"
                placeholder="model-name" /></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('timeout')"
              ><el-input-number
                v-model="credentialForm.timeout_seconds"
                :min="1"
                :max="3600"
                controls-position="right" /></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('rateLimit')"
              ><el-input-number
                v-model="credentialForm.rate_limit"
                :min="0"
                controls-position="right" /></el-form-item></el-col></el-row
        ><el-divider
          v-if="credentialForm.kind === 'embed'"
          content-position="left"
          >{{ $t("embeddingLimits") }}</el-divider
        ><el-row v-if="credentialForm.kind === 'embed'" :gutter="14"
          ><el-col
            v-for="item in [
              { key: 'dimensions', label: 'dimensions' },
              { key: 'max_batch_size', label: 'maxBatchSize' },
              { key: 'max_batch_chars', label: 'maxBatchChars' },
              { key: 'max_input_chars', label: 'maxInputChars' },
              { key: 'input_overlap_chars', label: 'inputOverlapChars' },
            ]"
            :key="item.key"
            :xs="12"
            :sm="8"
            ><el-form-item :label="$t(item.label)"
              ><el-input-number
                v-model="credentialForm[item.key]"
                :min="0"
                controls-position="right" /></el-form-item></el-col></el-row
        ><el-divider
          v-if="credentialForm.kind === 'rerank'"
          content-position="left"
          >{{ $t("rerankConfig") }}</el-divider
        ><el-row v-if="credentialForm.kind === 'rerank'" :gutter="14"
          ><el-col :xs="12" :sm="8"
            ><el-form-item :label="$t('topN')"
              ><el-input-number
                v-model="credentialForm.top_n"
                :min="0"
                controls-position="right" /></el-form-item></el-col
          ><el-col :xs="12" :sm="8"
            ><el-form-item :label="$t('minScore')"
              ><el-input-number
                v-model="credentialForm.min_score"
                :min="0"
                :max="1"
                :step="0.01"
                controls-position="right" /></el-form-item></el-col
          ><el-col :xs="12" :sm="8"
            ><el-form-item :label="$t('tpmLimit')"
              ><el-input-number
                v-model="credentialForm.tpm_limit"
                :min="0"
                controls-position="right" /></el-form-item></el-col></el-row
        ><el-divider
          v-if="credentialForm.kind === 'llm_rerank'"
          content-position="left"
          >{{ $t("llmRerankConfig") }}</el-divider
        ><el-row v-if="credentialForm.kind === 'llm_rerank'" :gutter="14"
          ><el-col :xs="12" :sm="8"
            ><el-form-item :label="$t('maxCandidates')"
              ><el-input-number
                v-model="credentialForm.max_candidates"
                :min="0"
                controls-position="right" /></el-form-item></el-col
          ><el-col :xs="12" :sm="8"
            ><el-form-item :label="$t('outputTopK')"
              ><el-input-number
                v-model="credentialForm.output_top_k"
                :min="0"
                controls-position="right" /></el-form-item></el-col
          ><el-col :xs="12" :sm="8"
            ><el-form-item :label="$t('snippetChars')"
              ><el-input-number
                v-model="credentialForm.snippet_chars"
                :min="0"
                controls-position="right" /></el-form-item></el-col></el-row
        ><el-divider
          v-if="credentialForm.kind === 'query_rewrite'"
          content-position="left"
          >{{ $t("rewriteConfig") }}</el-divider
        ><el-row v-if="credentialForm.kind === 'query_rewrite'" :gutter="14"
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('numRewrites')"
              ><el-input-number
                v-model="credentialForm.num_rewrites"
                :min="0"
                controls-position="right" /></el-form-item></el-col></el-row
        ><el-divider content-position="left">{{ $t("notes") }}</el-divider
        ><el-form-item :label="$t('note')"
          ><el-input
            v-model="credentialForm.note"
            type="textarea"
            :rows="2" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="credentialDialog = false">{{
          $t("cancel")
        }}</el-button
        ><el-button
          type="primary"
          :loading="credentialSubmitting"
          :icon="Check"
          @click="saveCredential"
          >{{ editingCredential ? $t("saveChanges") : $t("save") }}</el-button
        ></template
      ></el-dialog
    >
    <el-dialog
      v-model="duplicateDialog"
      :title="$t('duplicate')"
      width="min(760px, calc(100vw - 30px))"
      destroy-on-close
      ><p class="dialog-intro">{{ $t("cloneHint") }}</p>
      <el-form label-position="top" class="credential-form"
        ><el-divider content-position="left">{{ $t("identity") }}</el-divider
        ><el-row :gutter="14"
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('newName')"
              ><el-input v-model="duplicateForm.name" :placeholder="$t('inheritSource')" /></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('kind')"
              ><el-select
                v-model="duplicateForm.kind"
                :placeholder="$t('inheritSource')"
                ><el-option
                  v-for="option in kindOptions"
                  :key="option.value"
                  :value="option.value"
                  :label="option.label" /></el-select></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('provider')"
              ><el-input v-model="duplicateForm.provider" :placeholder="$t('inheritSource')" /></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('status')"
              ><el-select
                v-model="duplicateForm.status"
                :placeholder="$t('inheritSource')"
                ><el-option
                  value="active"
                  :label="$t('active')" /><el-option
                  value="disabled"
                  :label="$t('disabled')" /></el-select></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('priority')"
              ><el-input-number
                v-model="duplicateForm.priority"
                :min="0"
                :max="100000"
                controls-position="right" /></el-form-item></el-col></el-row
        ><el-divider content-position="left">{{ $t("connectionConfig") }}</el-divider
        ><el-row :gutter="14"
          ><el-col :span="24"
            ><el-form-item :label="$t('apiKey')"
              ><el-input
                v-model="duplicateForm.api_key"
                type="password"
                show-password
                :placeholder="$t('apiKeyHintClone')" /></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('endpoint')"
              ><el-input v-model="duplicateForm.endpoint" :placeholder="$t('inheritSource')" /></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('model')"
              ><el-input v-model="duplicateForm.model" :placeholder="$t('inheritSource')" /></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('timeout')"
              ><el-input-number
                v-model="duplicateForm.timeout_seconds"
                :min="1"
                :max="3600"
                controls-position="right" /></el-form-item></el-col
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('rateLimit')"
              ><el-input-number
                v-model="duplicateForm.rate_limit"
                :min="0"
                controls-position="right" /></el-form-item></el-col></el-row
        ><el-divider
          v-if="duplicateEffectiveKind === 'embed'"
          content-position="left"
          >{{ $t("embeddingLimits") }}</el-divider
        ><el-row v-if="duplicateEffectiveKind === 'embed'" :gutter="14"
          ><el-col
            v-for="item in [
              { key: 'dimensions', label: 'dimensions' },
              { key: 'max_batch_size', label: 'maxBatchSize' },
              { key: 'max_batch_chars', label: 'maxBatchChars' },
              { key: 'max_input_chars', label: 'maxInputChars' },
              { key: 'input_overlap_chars', label: 'inputOverlapChars' },
            ]"
            :key="item.key"
            :xs="12"
            :sm="8"
            ><el-form-item :label="$t(item.label)"
              ><el-input-number
                v-model="duplicateForm[item.key]"
                :min="0"
                controls-position="right" /></el-form-item></el-col></el-row
        ><el-divider
          v-if="duplicateEffectiveKind === 'rerank'"
          content-position="left"
          >{{ $t("rerankConfig") }}</el-divider
        ><el-row v-if="duplicateEffectiveKind === 'rerank'" :gutter="14"
          ><el-col :xs="12" :sm="8"
            ><el-form-item :label="$t('topN')"
              ><el-input-number v-model="duplicateForm.top_n" :min="0" controls-position="right" /></el-form-item></el-col
          ><el-col :xs="12" :sm="8"
            ><el-form-item :label="$t('minScore')"
              ><el-input-number v-model="duplicateForm.min_score" :min="0" :max="1" :step="0.01" controls-position="right" /></el-form-item></el-col
          ><el-col :xs="12" :sm="8"
            ><el-form-item :label="$t('tpmLimit')"
              ><el-input-number v-model="duplicateForm.tpm_limit" :min="0" controls-position="right" /></el-form-item></el-col></el-row
        ><el-divider
          v-if="duplicateEffectiveKind === 'llm_rerank'"
          content-position="left"
          >{{ $t("llmRerankConfig") }}</el-divider
        ><el-row v-if="duplicateEffectiveKind === 'llm_rerank'" :gutter="14"
          ><el-col :xs="12" :sm="8"
            ><el-form-item :label="$t('maxCandidates')"
              ><el-input-number v-model="duplicateForm.max_candidates" :min="0" controls-position="right" /></el-form-item></el-col
          ><el-col :xs="12" :sm="8"
            ><el-form-item :label="$t('outputTopK')"
              ><el-input-number v-model="duplicateForm.output_top_k" :min="0" controls-position="right" /></el-form-item></el-col
          ><el-col :xs="12" :sm="8"
            ><el-form-item :label="$t('snippetChars')"
              ><el-input-number v-model="duplicateForm.snippet_chars" :min="0" controls-position="right" /></el-form-item></el-col></el-row
        ><el-divider
          v-if="duplicateEffectiveKind === 'query_rewrite'"
          content-position="left"
          >{{ $t("rewriteConfig") }}</el-divider
        ><el-row v-if="duplicateEffectiveKind === 'query_rewrite'" :gutter="14"
          ><el-col :xs="24" :sm="12"
            ><el-form-item :label="$t('numRewrites')"
              ><el-input-number v-model="duplicateForm.num_rewrites" :min="0" controls-position="right" /></el-form-item></el-col></el-row
        ><el-divider content-position="left">{{ $t("notes") }}</el-divider
        ><el-form-item :label="$t('note')"
          ><el-input v-model="duplicateForm.note" type="textarea" :rows="2" :placeholder="$t('inheritSource')" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="duplicateDialog = false">{{
          $t("cancel")
        }}</el-button
        ><el-button
          type="primary"
          :loading="duplicateSubmitting"
          :icon="CopyDocument"
          @click="duplicateCredential"
          >{{ $t("createCopy") }}</el-button
        ></template
      ></el-dialog
    >
  </el-config-provider>
</template>
