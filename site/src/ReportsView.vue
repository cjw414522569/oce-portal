<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Refresh, Warning, DataAnalysis, Coin, Files, DataLine } from "@element-plus/icons-vue";

const props = defineProps({
  reports: { type: Object, required: true },
  activeTab: { type: String, required: true },
  windowHours: { type: Number, required: true },
  bucket: { type: String, required: true },
  apiBuckets: { type: Array, required: true },
  retrievalBuckets: { type: Array, required: true },
  resourceBuckets: { type: Array, required: true },
  tokenBuckets: { type: Array, required: true },
  tokenKinds: { type: Array, required: true },
  stages: { type: Array, required: true },
  endpointRows: { type: Array, required: true },
  tokenModels: { type: Array, required: true },
  tokenCredentials: { type: Array, required: true },
  maxStage: { type: Number, required: true },
  maxStorage: { type: Number, required: true },
  diskClass: { type: String, required: true },
});
const emit = defineEmits(["update:activeTab", "update:windowHours", "refresh"]);
const { t, locale } = useI18n();
const queryTab = ref("slow");

const presets = computed(() => [
  { value: 6, label: t("last6h") },
  { value: 24, label: t("last24h") },
  { value: 168, label: t("last7d") },
  { value: 720, label: t("last30d") },
]);
const tabs = computed(() => [
  { value: "overview", label: t("reportOverview") },
  { value: "quality", label: t("retrievalQuality") },
  { value: "tokens", label: t("tokenUsage") },
  { value: "inventory", label: t("indexAssets") },
  { value: "storage", label: t("capacityStorage") },
]);
const reportTitle = computed(() => tabs.value.find((tab) => tab.value === props.activeTab)?.label || t("reports"));
const reportErrorMessage = computed(() => Object.values(props.reports.errors || {}).find(Boolean) || "");
const apiTotal = computed(() => props.apiBuckets.reduce((sum, row) => sum + Number(row.count || 0), 0));
const apiErrors = computed(() => props.apiBuckets.reduce((sum, row) => sum + Number(row.error_count || 0), 0));
const retrievalTotal = computed(() => props.retrievalBuckets.reduce((sum, row) => sum + Number(row.count || 0), 0));
const retrievalEmpty = computed(() => props.retrievalBuckets.reduce((sum, row) => sum + Number(row.empty_count || 0), 0));
const latestRetrievalRate = computed(() => props.retrievalBuckets.at(-1)?.empty_rate || 0);
const latestApiLatency = computed(() => props.apiBuckets.at(-1)?.p95_latency_ms || 0);
const maxApi = computed(() => Math.max(1, ...props.apiBuckets.map((row) => Number(row.count || 0))));
const maxRetrieval = computed(() => Math.max(1, ...props.retrievalBuckets.map((row) => Number(row.count || 0))));
const maxResource = computed(() => Math.max(100, ...props.resourceBuckets.map((row) => Number(row.avg_cpu_percent || 0)), ...props.resourceBuckets.map((row) => Number(row.avg_mem_percent || 0))));
const storageRows = computed(() => (props.reports.storage?.tables || []).slice().sort((a, b) => Number(b.bytes || 0) - Number(a.bytes || 0)));
const vector = computed(() => props.reports.storage?.vector || null);
const vectorCollections = computed(() => (vector.value?.collections || []).slice().sort((a, b) => Number(b.est_bytes || 0) - Number(a.est_bytes || 0)));
const inventoryMetrics = computed(() => [
  { key: "blob_total", label: t("blobTotal"), value: props.reports.inventory?.blob_total, icon: Files },
  { key: "chunk_total", label: t("chunkTotal"), value: props.reports.inventory?.chunk_total, icon: DataAnalysis },
  { key: "symbol_total", label: t("symbolTotal"), value: props.reports.inventory?.symbol_total, icon: DataLine },
  { key: "chain_total", label: t("chainTotal"), value: props.reports.inventory?.chain_total, icon: Coin },
]);
function number(value) { return Number(value || 0).toLocaleString(locale.value === "en" ? "en-US" : "zh-CN"); }
function compact(value) {
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
  const scaled = amount / 1024 ** index;
  return `${index ? scaled.toFixed(scaled >= 10 ? 0 : 1) : amount} ${units[index]}`;
}
function percent(value) { return `${(Number(value || 0) * 100).toFixed(1)}%`; }
function date(value, utc = false) {
  if (!value) return "--";
  return new Intl.DateTimeFormat(locale.value === "en" ? "en-US" : "zh-CN", utc ? { month: "short", day: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) + (utc ? " UTC" : "");
}
function bucketLabel(value) { return date(value, props.bucket === "day"); }
function stageLabel(value) { return String(value || "").replaceAll("_", " "); }
function vectorModeLabel(value) {
  if (value === "server") return t("vectorModeServer");
  if (value === "lite") return t("vectorModeLite");
  if (!value || value === "unavailable") return t("vectorModeUnavailable");
  return value || t("vectorModeUnknown");
}
function queryText(value) { return value || t("queryNotRecorded"); }
function intent(value) { return value || t("uncategorized"); }
function credential(value) { return value === null || value === undefined ? t("envFallback") : `#${value}`; }
function scale(value, max) { return Math.max(0, Math.min(100, (Number(value || 0) / max) * 100)); }
function linePoints(rows, field, max) {
  if (!rows.length) return "";
  return rows.map((row, index) => {
    const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
    const y = 96 - (Number(row[field] || 0) / max) * 84;
    return `${x},${Math.max(4, y)}`;
  }).join(" ");
}
function chooseTab(value) { emit("update:activeTab", value); }
function chooseWindow(value) { emit("update:windowHours", Number(value)); emit("refresh", true); }
function errorFor(key) { return props.reports.errors?.[key] || ""; }
function loadingFor(key) { return Boolean(props.reports.loading?.[key]); }
</script>

<template>
  <section class="view-section reports-view">
    <div class="page-heading report-heading">
      <div>
        <div class="overline">{{ $t("reports") }} / {{ windowHours }}H · {{ bucket === "day" ? $t("utcDays") : $t("hourly") }}</div>
        <h2>{{ reportTitle }}</h2>
        <p>{{ $t("reportsHint") }}</p>
      </div>
      <div class="report-controls">
        <el-segmented :model-value="activeTab" :options="tabs.map((tab) => ({ label: tab.label, value: tab.value }))" @change="chooseTab" />
        <el-select :model-value="windowHours" class="window-select" @change="chooseWindow">
          <el-option v-for="preset in presets" :key="preset.value" :value="preset.value" :label="preset.label" />
        </el-select>
        <el-button type="primary" plain :icon="Refresh" :loading="loadingFor('apiCalls') || loadingFor('retrieval')" @click="emit('refresh', true)">{{ $t("refreshReports") }}</el-button>
      </div>
    </div>

    <el-alert v-if="reportErrorMessage" class="report-alert" type="warning" :closable="false" show-icon :title="reportErrorMessage" />

    <div v-show="activeTab === 'overview'" class="report-tab-content">
      <el-row :gutter="14" class="metric-row">
        <el-col :xs="12" :sm="6"><el-card class="metric-card accent" shadow="never"><el-statistic :title="$t('apiCalls')" :value="apiTotal" /><div class="metric-foot"><span>{{ number(apiErrors) }} {{ $t("errors") }}</span><b>{{ percent(apiTotal ? apiErrors / apiTotal : 0) }}</b></div></el-card></el-col>
        <el-col :xs="12" :sm="6"><el-card class="metric-card" shadow="never"><el-statistic :title="$t('retrievalRequests')" :value="retrievalTotal" /><div class="metric-foot"><span>{{ number(retrievalEmpty) }} {{ $t("emptyResults") }}</span><b>{{ percent(retrievalTotal ? retrievalEmpty / retrievalTotal : 0) }}</b></div></el-card></el-col>
        <el-col :xs="12" :sm="6"><el-card class="metric-card" shadow="never"><el-statistic :title="$t('p95Latency')" :value="latestApiLatency" suffix="ms" /><div class="metric-foot"><span>{{ $t("latestBucket") }}</span><b>{{ bucketLabel(props.apiBuckets.at(-1)?.ts) }}</b></div></el-card></el-col>
        <el-col :xs="12" :sm="6"><el-card class="metric-card" shadow="never"><el-statistic :title="$t('emptyRate')" :value="Number(latestRetrievalRate * 100).toFixed(1)" suffix="%" /><div class="metric-foot"><span>{{ $t("latestBucket") }}</span><b>{{ bucketLabel(props.retrievalBuckets.at(-1)?.ts) }}</b></div></el-card></el-col>
      </el-row>
      <el-row :gutter="14">
        <el-col :xs="24" :lg="12"><el-card class="panel-card chart-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("apiCalls") }}</div><h3>{{ $t("apiTrend") }}</h3></div><span class="muted">{{ number(apiTotal) }}</span></div></template><div v-if="!apiTotal && !loadingFor('apiCalls')" class="chart-empty">{{ $t("reportEmpty") }}</div><svg v-else class="report-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="API trend"><polyline :points="linePoints(apiBuckets, 'count', maxApi)" fill="none" stroke="var(--oce-teal)" stroke-width="2" vector-effect="non-scaling-stroke" /><line x1="0" y1="96" x2="100" y2="96" stroke="var(--oce-line)" stroke-width="1" vector-effect="non-scaling-stroke" /></svg><div class="chart-axis"><span>{{ date(apiBuckets[0]?.ts, bucket === 'day') }}</span><span>{{ date(apiBuckets.at(-1)?.ts, bucket === 'day') }}</span></div></el-card></el-col>
        <el-col :xs="24" :lg="12"><el-card class="panel-card chart-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("retrievalQuality") }}</div><h3>{{ $t("emptyRateTrend") }}</h3></div><span class="muted">{{ percent(retrievalTotal ? retrievalEmpty / retrievalTotal : 0) }}</span></div></template><div v-if="!retrievalTotal && !loadingFor('retrieval')" class="chart-empty">{{ $t("reportEmpty") }}</div><svg v-else class="report-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Retrieval quality trend"><polyline :points="linePoints(retrievalBuckets, 'empty_rate', 1)" fill="none" stroke="var(--oce-coral)" stroke-width="2" vector-effect="non-scaling-stroke" /><line x1="0" y1="96" x2="100" y2="96" stroke="var(--oce-line)" stroke-width="1" vector-effect="non-scaling-stroke" /></svg><div class="chart-axis"><span>{{ date(retrievalBuckets[0]?.ts, bucket === 'day') }}</span><span>{{ date(retrievalBuckets.at(-1)?.ts, bucket === 'day') }}</span></div></el-card></el-col>
      </el-row>
      <el-card class="panel-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("endpoints") }}</div><h3>{{ $t("apiHealth") }}</h3></div><span class="muted">{{ endpointRows.length }} {{ $t("rows") }}</span></div></template><el-table v-if="endpointRows.length" :data="endpointRows" stripe><el-table-column prop="method" :label="$t('method')" width="95" /><el-table-column prop="endpoint" :label="$t('endpoint')" min-width="240" /><el-table-column prop="count" :label="$t('calls')" width="100"><template #default="{ row }">{{ number(row.count) }}</template></el-table-column><el-table-column :label="$t('errorRate')" width="120"><template #default="{ row }"><span :class="{ 'danger-text': row.error_rate > .05 }">{{ percent(row.error_rate) }}</span></template></el-table-column><el-table-column :label="$t('p95Latency')" width="130"><template #default="{ row }">{{ number(row.p95_latency_ms) }}ms</template></el-table-column></el-table><el-empty v-else :description="$t('reportEmpty')" :image-size="60" /></el-card>
      <el-card v-if="props.reports.apiCalls?.errors?.length" class="panel-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("errors") }}</div><h3>{{ $t("errorBreakdown") }}</h3></div></div></template><el-table :data="props.reports.apiCalls.errors" stripe><el-table-column prop="status_code" :label="$t('statusCode')" width="120" /><el-table-column prop="error_type" :label="$t('errorType')" min-width="180" /><el-table-column :label="$t('calls')" width="110"><template #default="{ row }">{{ number(row.count) }}</template></el-table-column><el-table-column :label="$t('lastSeen')" width="160"><template #default="{ row }">{{ date(row.last_ts) }}</template></el-table-column></el-table></el-card>
    </div>

    <div v-show="activeTab === 'quality'" class="report-tab-content">
      <el-alert v-if="errorFor('retrieval') || errorFor('slowQueries') || errorFor('emptyQueries')" class="report-alert" type="warning" :closable="false" show-icon :title="errorFor('retrieval') || errorFor('slowQueries') || errorFor('emptyQueries')" />
      <el-row :gutter="14"><el-col :xs="24" :lg="14"><el-card class="panel-card chart-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("retrievalQuality") }}</div><h3>{{ $t("emptyRateTrend") }}</h3></div><span class="muted">{{ percent(retrievalTotal ? retrievalEmpty / retrievalTotal : 0) }}</span></div></template><div v-if="!retrievalTotal" class="chart-empty">{{ $t("reportEmpty") }}</div><svg v-else class="report-chart" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline :points="linePoints(retrievalBuckets, 'empty_rate', 1)" fill="none" stroke="var(--oce-coral)" stroke-width="2" vector-effect="non-scaling-stroke" /></svg></el-card></el-col><el-col :xs="24" :lg="10"><el-card class="panel-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("stages") }}</div><h3>{{ $t("stageLatency") }}</h3></div></div></template><div v-if="!stages.length" class="chart-empty">{{ $t("reportEmpty") }}</div><div v-else class="stage-list"><div v-for="row in stages" :key="row.stage" class="stage-row"><div class="stage-label"><span>{{ stageLabel(row.stage) }}</span><b>{{ Number(row.avg_ms || 0).toFixed(1) }}ms</b></div><el-progress :percentage="scale(row.avg_ms, maxStage)" :show-text="false" :stroke-width="7" /></div></div></el-card></el-col></el-row>
      <el-card class="panel-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("retrievalDetails") }}</div><h3>{{ $t("slowAndEmpty") }}</h3></div><el-radio-group v-model="queryTab" size="small"><el-radio-button label="slow">{{ $t("slowQueries") }}</el-radio-button><el-radio-button label="empty">{{ $t("emptyQueries") }}</el-radio-button></el-radio-group></div></template><div v-if="errorFor(queryTab === 'slow' ? 'slowQueries' : 'emptyQueries')" class="inline-error">{{ errorFor(queryTab === 'slow' ? 'slowQueries' : 'emptyQueries') }}</div><el-table v-else-if="(queryTab === 'slow' ? props.reports.slowQueries?.items : props.reports.emptyQueries?.items)?.length" :data="queryTab === 'slow' ? props.reports.slowQueries.items : props.reports.emptyQueries.items" stripe><el-table-column :label="$t('time')" width="150"><template #default="{ row }">{{ date(row.ts) }}</template></el-table-column><el-table-column :label="$t('query')" min-width="280"><template #default="{ row }"><span class="query-text">{{ queryText(row.query_text) }}</span></template></el-table-column><el-table-column :label="$t('duration')" width="110"><template #default="{ row }">{{ number(row.total_ms) }}ms</template></el-table-column><el-table-column :label="$t('hits')" width="90"><template #default="{ row }">{{ number(row.hit_count) }}</template></el-table-column><el-table-column :label="$t('intent')" width="130"><template #default="{ row }">{{ intent(row.intent) }}</template></el-table-column></el-table><el-empty v-else :description="$t('reportEmpty')" :image-size="60" /></el-card>
    </div>

    <div v-show="activeTab === 'tokens'" class="report-tab-content"><el-row :gutter="14"><el-col :xs="24" :lg="14"><el-card class="panel-card chart-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("tokenUsage") }}</div><h3>{{ $t("tokenTrend") }}</h3></div><span class="muted">{{ compact(props.reports.tokens?.tokens_total) }}</span></div></template><div v-if="!props.reports.tokens?.tokens_total" class="chart-empty">{{ $t("reportEmpty") }}</div><div v-else class="stacked-bars"><div v-for="(row, index) in tokenBuckets" :key="row.ts" class="stacked-bar"><div v-for="(kind, kindIndex) in tokenKinds" :key="kind" class="stacked-segment" :style="{ height: `${scale(row[kind], Math.max(1, ...tokenBuckets.map((item) => tokenKinds.reduce((sum, name) => sum + Number(item[name] || 0), 0))))}%`, background: kindIndex % 2 ? 'var(--oce-coral)' : 'var(--oce-teal)' }" :title="`${kind}: ${number(row[kind])}`"></div></div></div><div class="chart-axis"><span>{{ date(tokenBuckets[0]?.ts, bucket === 'day') }}</span><span>{{ date(tokenBuckets.at(-1)?.ts, bucket === 'day') }}</span></div></el-card></el-col><el-col :xs="24" :lg="10"><el-card class="panel-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("models") }}</div><h3>{{ $t("tokenRanking") }}</h3></div></div></template><el-table v-if="tokenModels.length" :data="tokenModels" stripe><el-table-column prop="model" :label="$t('model')" min-width="150" /><el-table-column prop="kind" :label="$t('kind')" width="120" /><el-table-column :label="$t('tokens')" width="110"><template #default="{ row }">{{ compact(row.total_tokens) }}</template></el-table-column></el-table><el-empty v-else :description="$t('reportEmpty')" :image-size="55" /></el-card></el-col></el-row><el-card class="panel-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("credentials") }}</div><h3>{{ $t("credentialRanking") }}</h3></div></div></template><el-table v-if="tokenCredentials.length" :data="tokenCredentials" stripe><el-table-column :label="$t('credential')" min-width="200"><template #default="{ row }">{{ credential(row.credential_id) }}</template></el-table-column><el-table-column :label="$t('calls')" width="120"><template #default="{ row }">{{ number(row.calls) }}</template></el-table-column><el-table-column :label="$t('tokens')" width="140"><template #default="{ row }">{{ compact(row.total_tokens) }}</template></el-table-column></el-table><el-empty v-else :description="$t('reportEmpty')" :image-size="55" /></el-card></div>

    <div v-show="activeTab === 'inventory'" class="report-tab-content"><el-row :gutter="14" class="metric-row"><el-col v-for="metric in inventoryMetrics" :key="metric.key" :xs="12" :sm="6"><el-card class="metric-card" shadow="never"><div class="inventory-icon"><el-icon><component :is="metric.icon" /></el-icon></div><div class="metric-label">{{ metric.label }}</div><strong class="inventory-value">{{ compact(metric.value) }}</strong></el-card></el-col></el-row><el-row :gutter="14"><el-col :xs="24" :lg="8"><el-card class="panel-card" shadow="never"><template #header><h3>{{ $t("blobStatus") }}</h3></template><div class="rank-list"><div v-for="row in (props.reports.inventory?.blob_by_status || [])" :key="row.key" class="rank-row"><span>{{ row.key }}</span><b>{{ number(row.count) }}</b></div><el-empty v-if="!(props.reports.inventory?.blob_by_status || []).length" :description="$t('reportEmpty')" :image-size="50" /></div></el-card></el-col><el-col :xs="24" :lg="8"><el-card class="panel-card" shadow="never"><template #header><h3>{{ $t("languageDistribution") }}</h3></template><div class="rank-list"><div v-for="row in (props.reports.inventory?.blob_by_language || [])" :key="row.key" class="rank-row"><span>{{ row.key }}</span><b>{{ number(row.count) }}</b></div><el-empty v-if="!(props.reports.inventory?.blob_by_language || []).length" :description="$t('reportEmpty')" :image-size="50" /></div></el-card></el-col><el-col :xs="24" :lg="8"><el-card class="panel-card" shadow="never"><template #header><h3>{{ $t("indexHealth") }}</h3></template><div class="health-stats"><div><span>{{ $t("blobRetrying") }}</span><b>{{ number(props.reports.inventory?.blob_retrying) }}</b></div><div><span>{{ $t("pendingEmbed") }}</span><b>{{ number(props.reports.inventory?.chunk_pending_embed) }}</b></div><div><span>{{ $t("stagingRows") }}</span><b>{{ number(props.reports.inventory?.staging_rows) }}</b></div><div><span>{{ $t("contentBytes") }}</span><b>{{ bytes(Number(props.reports.inventory?.blob_content_bytes || 0) + Number(props.reports.inventory?.chunk_content_bytes || 0)) }}</b></div></div></el-card></el-col></el-row></div>

    <div v-show="activeTab === 'storage'" class="report-tab-content">
      <el-row :gutter="14" class="metric-row">
        <el-col :xs="24" :sm="8"><el-card class="metric-card" shadow="never"><el-statistic :title="$t('totalTableBytes')" :value="bytes(props.reports.storage?.total_table_bytes)" /></el-card></el-col>
        <el-col :xs="24" :sm="8"><el-card class="metric-card" shadow="never"><el-statistic :title="$t('dataDirSize')" :value="bytes(props.reports.storage?.data_dir_total_bytes)" /></el-card></el-col>
        <el-col :xs="24" :sm="8"><el-card class="metric-card" shadow="never"><el-statistic :title="$t('diskDaysUntilFull')" :value="props.reports.resources?.disk_days_until_full === null || props.reports.resources?.disk_days_until_full === undefined ? $t('diskNoGrowth') : Number(props.reports.resources.disk_days_until_full).toFixed(1)" :class="`disk-${diskClass}`" /></el-card></el-col>
      </el-row>
      <el-row :gutter="14">
        <el-col :xs="24" :lg="13"><el-card class="panel-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ props.reports.storage?.dialect || 'SQLite' }}</div><h3>{{ $t("tableSpace") }}</h3></div></div></template><div v-if="storageRows.length" class="storage-list"><div v-for="row in storageRows" :key="row.table" class="storage-row"><div class="storage-label"><span>{{ row.table }}</span><b>{{ row.approximate ? '~' : '' }}{{ bytes(row.bytes) }}</b></div><el-progress :percentage="scale(row.bytes, maxStorage)" :show-text="false" :stroke-width="8" /></div></div><el-empty v-else :description="$t('reportEmpty')" :image-size="55" /></el-card></el-col>
        <el-col :xs="24" :lg="11"><el-card class="panel-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("resources") }}</div><h3>{{ $t("resourceTrend") }}</h3></div><el-tag v-if="diskClass !== 'normal'" :type="diskClass === 'danger' ? 'danger' : 'warning'" effect="light"><el-icon><Warning /></el-icon>{{ $t("diskAttention") }}</el-tag></div></template><div v-if="!resourceBuckets.length" class="chart-empty">{{ $t("reportEmpty") }}</div><svg v-else class="report-chart" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline :points="linePoints(resourceBuckets, 'avg_cpu_percent', maxResource)" fill="none" stroke="var(--oce-coral)" stroke-width="2" vector-effect="non-scaling-stroke" /><polyline :points="linePoints(resourceBuckets, 'avg_mem_percent', maxResource)" fill="none" stroke="var(--oce-teal)" stroke-width="2" vector-effect="non-scaling-stroke" /></svg><div class="chart-legend"><span><i class="legend-dot coral"></i>{{ $t("cpu") }}</span><span><i class="legend-dot teal"></i>{{ $t("memory") }}</span></div></el-card></el-col>
      </el-row>
      <el-card class="panel-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("dataFiles") }}</div><h3>{{ $t("storageFiles") }}</h3></div><span class="muted">{{ props.reports.storage?.data_dir || "--" }}</span></div></template><el-table v-if="props.reports.storage?.data_files?.length" :data="props.reports.storage.data_files" stripe><el-table-column prop="name" :label="$t('name')" min-width="220" /><el-table-column :label="$t('size')" width="140"><template #default="{ row }">{{ bytes(row.bytes) }}</template></el-table-column></el-table><el-empty v-else :description="$t('reportEmpty')" :image-size="55" /></el-card>
      <el-card class="panel-card vector-card" shadow="never"><template #header><div class="panel-header"><div><div class="overline">{{ $t("vectorStore") }}</div><h3>{{ $t("vectorCollections") }}</h3></div><el-tag :type="vector?.error ? 'danger' : !vector || vector?.mode === 'unavailable' ? 'warning' : 'success'" effect="light">{{ vectorModeLabel(vector?.mode) }}</el-tag></div></template><el-alert v-if="vector?.error" type="error" :title="`${$t('vectorError')}: ${vector.error}`" :closable="false" show-icon /><template v-else><el-row :gutter="14" class="vector-summary"><el-col :xs="24" :sm="8"><div class="runtime-stat"><span>{{ $t("vectorMode") }}</span><strong>{{ vectorModeLabel(vector?.mode) }}</strong></div></el-col><el-col :xs="24" :sm="8"><div class="runtime-stat"><span>{{ $t("vectorFileSize") }}</span><strong>{{ bytes(vector?.file_bytes) }}</strong></div></el-col><el-col :xs="24" :sm="8"><div class="runtime-stat"><span>{{ $t("vectorCollections") }}</span><strong>{{ number(vectorCollections.length) }}</strong></div></el-col></el-row><el-table v-if="vectorCollections.length" :data="vectorCollections" stripe><el-table-column prop="name" :label="$t('name')" min-width="230" /><el-table-column :label="$t('vectorRows')" width="140"><template #default="{ row }">{{ number(row.rows) }}</template></el-table-column><el-table-column :label="$t('estimatedSize')" width="160"><template #default="{ row }">~{{ bytes(row.est_bytes) }}</template></el-table-column></el-table><el-empty v-else :description="$t('noVectorData')" :image-size="55" /></template></el-card>
    </div>
  </section>
</template>
