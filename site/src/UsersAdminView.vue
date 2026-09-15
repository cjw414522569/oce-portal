<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import { Delete, Refresh, Search } from "@element-plus/icons-vue";

const props = defineProps({
  api: { type: Object, default: null },
});

const { t } = useI18n();
const users = ref([]);
const loading = ref(false);
const error = ref("");
const selection = ref([]);
const search = ref("");

const registration = reactive({
  info: null,
  maxUsersInput: null,
  saving: false,
});

const rangeForm = reactive({
  range: null, // [Date, Date]
  preview: null, // { deleted_count, deleted_ids }
  previewing: false,
  deleting: false,
});

const filteredUsers = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return users.value;
  return users.value.filter(
    (row) =>
      row.username.toLowerCase().includes(query) ||
      (row.name || "").toLowerCase().includes(query) ||
      String(row.id) === query,
  );
});

async function load() {
  if (!props.api) return;
  loading.value = true;
  error.value = "";
  try {
    const [listResponse, info] = await Promise.all([
      props.api.users(),
      props.api.registrationInfo().catch(() => null),
    ]);
    users.value = listResponse?.users || [];
    if (info) {
      registration.info = info;
      registration.maxUsersInput = info.effective_max_users;
    }
  } catch (err) {
    error.value = String(err?.message || err);
  } finally {
    loading.value = false;
  }
}

async function toggleStatus(row) {
  const next = row.status === "active" ? "disabled" : "active";
  const tip = next === "disabled" ? t("banConfirm") : t("unbanConfirm");
  try {
    await ElMessageBox.confirm(
      `${tip} @${row.username}?`,
      next === "disabled" ? t("banUser") : t("unbanUser"),
      { type: "warning" },
    );
  } catch {
    return;
  }
  try {
    await props.api.setUserStatus(row.id, next);
    ElMessage.success(t("userStatusDone"));
    await load();
  } catch (err) {
    ElMessage.error(String(err?.message || err));
  }
}

async function removeUser(row) {
  try {
    await ElMessageBox.confirm(
      `${t("deleteUserConfirm")} @${row.username}?`,
      t("deleteUser"),
      { type: "warning", confirmButtonText: t("confirm") },
    );
  } catch {
    return;
  }
  try {
    const result = await props.api.deleteUser(row.id);
    ElMessage.success(`${t("deletedCount")}: ${result.deleted_count}`);
    await load();
  } catch (err) {
    ElMessage.error(String(err?.message || err));
  }
}

async function removeSelected() {
  const ids = selection.value.map((row) => row.id);
  if (!ids.length) return;
  try {
    await ElMessageBox.confirm(
      `${t("batchDeleteConfirm")} (${ids.length})?`,
      t("batchDelete"),
      { type: "warning", confirmButtonText: t("confirm") },
    );
  } catch {
    return;
  }
  try {
    const result = await props.api.batchDeleteUsers(ids);
    ElMessage.success(`${t("deletedCount")}: ${result.deleted_count}`);
    selection.value = [];
    await load();
  } catch (err) {
    ElMessage.error(String(err?.message || err));
  }
}

async function saveMaxUsers() {
  const value = Number(registration.maxUsersInput);
  if (!Number.isInteger(value) || value < 0) {
    ElMessage.warning(t("quotaInvalid"));
    return;
  }
  registration.saving = true;
  try {
    registration.info = await props.api.setMaxUsers(value);
    ElMessage.success(t("quotaSaved"));
  } catch (err) {
    ElMessage.error(String(err?.message || err));
  } finally {
    registration.saving = false;
  }
}

function fmtDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function setWeekRange(offset) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 周一为一周起点
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  rangeForm.range = [monday, sunday];
  rangeForm.preview = null;
}

function setToday() {
  const now = new Date();
  rangeForm.range = [now, new Date(now)];
  rangeForm.preview = null;
}

async function previewRange() {
  if (!rangeForm.range?.length) return;
  rangeForm.previewing = true;
  try {
    rangeForm.preview = await props.api.deleteUsersRegistered(
      fmtDate(rangeForm.range[0]),
      fmtDate(rangeForm.range[1]),
      true,
    );
  } catch (err) {
    ElMessage.error(String(err?.message || err));
  } finally {
    rangeForm.previewing = false;
  }
}

async function deleteByRange() {
  if (!rangeForm.range?.length) return;
  try {
    await ElMessageBox.confirm(
      `${t("rangeDeleteConfirm")} (${rangeForm.preview?.deleted_count ?? "?"})?`,
      t("deleteByRange"),
      { type: "warning", confirmButtonText: t("confirm") },
    );
  } catch {
    return;
  }
  rangeForm.deleting = true;
  try {
    const result = await props.api.deleteUsersRegistered(
      fmtDate(rangeForm.range[0]),
      fmtDate(rangeForm.range[1]),
      false,
    );
    ElMessage.success(`${t("deletedCount")}: ${result.deleted_count}`);
    rangeForm.preview = null;
    await load();
  } catch (err) {
    ElMessage.error(String(err?.message || err));
  } finally {
    rangeForm.deleting = false;
  }
}

onMounted(load);
watch(() => props.api, load);
</script>

<template>
  <section class="view-section">
    <div class="page-heading">
      <div>
        <div class="overline">{{ $t("workspace") }} / {{ $t("users") }}</div>
        <h2>{{ $t("users") }}</h2>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load">{{
        $t("refresh")
      }}</el-button>
    </div>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
      class="mb"
    />

    <!-- 注册名额 -->
    <el-card shadow="never" class="mb quota-card">
      <template #header>
        <div class="card-header-row">
          <span>{{ $t("registrationQuota") }}</span>
          <el-tag
            v-if="registration.info"
            :type="registration.info.open ? 'success' : 'danger'"
            size="small"
            >{{
              registration.info.open
                ? $t("registrationOpen")
                : $t("registrationClosed")
            }}</el-tag
          >
        </div>
      </template>
      <div v-if="registration.info" class="quota-row">
        <el-statistic
          :title="$t('activeUsers')"
          :value="registration.info.active_count"
        />
        <el-statistic
          :title="$t('effectiveQuota')"
          :value="
            registration.info.effective_max_users === 0
              ? $t('unlimited')
              : registration.info.effective_max_users
          "
          :formatter="
            (v) => (v === $t('unlimited') ? v : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
          "
        />
        <div class="quota-setter">
          <el-input-number
            v-model="registration.maxUsersInput"
            :min="0"
            :step="1"
          />
          <el-button
            type="primary"
            plain
            :loading="registration.saving"
            @click="saveMaxUsers"
            >{{ $t("save") }}</el-button
          >
        </div>
        <small class="muted"
          >0 = {{ $t("unlimited") }}；{{
            $t("quotaHint", { env: registration.info.env_max_users || $t("unlimited") })
          }}</small
        >
      </div>
    </el-card>

    <!-- 按注册时间删除 -->
    <el-card shadow="never" class="mb">
      <template #header>{{ $t("deleteByRange") }}</template>
      <div class="range-row">
        <el-date-picker
          v-model="rangeForm.range"
          type="daterange"
          value-format="YYYY-MM-DD"
          :start-placeholder="$t('dateFrom')"
          :end-placeholder="$t('dateTo')"
        />
        <el-button size="small" @click="setToday()">{{
          $t("today")
        }}</el-button>
        <el-button size="small" @click="setWeekRange(0)">{{
          $t("thisWeek")
        }}</el-button>
        <el-button size="small" @click="setWeekRange(-1)">{{
          $t("lastWeek")
        }}</el-button>
        <el-button
          :loading="rangeForm.previewing"
          :disabled="!rangeForm.range"
          @click="previewRange"
          >{{ $t("preview") }}</el-button
        >
        <el-button
          type="danger"
          plain
          :loading="rangeForm.deleting"
          :disabled="!rangeForm.preview || rangeForm.preview.deleted_count === 0"
          @click="deleteByRange"
          >{{ $t("confirmDelete") }}</el-button
        >
      </div>
      <el-alert
        v-if="rangeForm.preview"
        :title="
          $t('rangePreview', { count: rangeForm.preview.deleted_count }) +
          ` (ID: ${rangeForm.preview.deleted_ids.join(', ') || '--'})`
        "
        :type="rangeForm.preview.deleted_count ? 'warning' : 'info'"
        :closable="false"
        show-icon
        class="mt"
      />
    </el-card>

    <!-- 用户表 -->
    <el-card shadow="never">
      <template #header>
        <div class="card-header-row">
          <span
            >{{ $t("users") }}
            <small class="muted">({{ filteredUsers.length }})</small></span
          >
          <div class="range-row">
            <el-input
              v-model="search"
              :placeholder="$t('searchUser')"
              :prefix-icon="Search"
              clearable
              size="small"
              style="width: 200px"
            />
            <el-button
              type="danger"
              plain
              size="small"
              :icon="Delete"
              :disabled="!selection.length"
              @click="removeSelected"
              >{{ $t("batchDelete")
              }}{{ selection.length ? ` (${selection.length})` : "" }}</el-button
            >
          </div>
        </div>
      </template>
      <el-table
        :data="filteredUsers"
        v-loading="loading"
        size="default"
        stripe
        @selection-change="(rows) => (selection = rows)"
      >
        <el-table-column type="selection" width="42" />
        <el-table-column prop="id" label="ID" width="64" />
        <el-table-column :label="$t('username')" min-width="140">
          <template #default="{ row }">
            <strong>{{ row.name || row.username }}</strong>
            <small class="muted block">@{{ row.username }}</small>
          </template>
        </el-table-column>
        <el-table-column prop="trust_level" label="TL" width="60" />
        <el-table-column :label="$t('status')" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'active' ? 'success' : 'danger'"
              size="small"
              >{{ row.status }}</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column :label="$t('keyLast4')" width="120">
          <template #default="{ row }">
            <code v-if="row.api_key_last4">••••{{ row.api_key_last4 }}</code>
            <span v-else class="muted">--</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('apiCalls24h')" width="110" align="right">
          <template #default="{ row }">{{ row.api_calls_24h }}</template>
        </el-table-column>
        <el-table-column :label="$t('tokens24h')" width="130" align="right">
          <template #default="{ row }">{{
            row.total_tokens_24h.toLocaleString()
          }}</template>
        </el-table-column>
        <el-table-column :label="$t('createdAt')" width="110">
          <template #default="{ row }">
            <span class="muted">{{ row.created_at.slice(0, 10) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('lastLogin')" width="160">
          <template #default="{ row }">
            <span class="muted">{{
              row.last_login_at
                ? new Date(row.last_login_at).toLocaleString()
                : "--"
            }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('actions')" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              :type="row.status === 'active' ? 'danger' : 'success'"
              text
              @click="toggleStatus(row)"
              >{{ row.status === "active" ? $t("banUser") : $t("unbanUser") }}</el-button
            >
            <el-button size="small" type="danger" text @click="removeUser(row)"
              >{{ $t("deleteUser") }}</el-button
            >
          </template>
        </el-table-column>
        <template #empty>
          <span class="muted">{{ loading ? $t("syncing") : "--" }}</span>
        </template>
      </el-table>
    </el-card>
  </section>
</template>
