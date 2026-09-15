<script setup>
import { onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";

const props = defineProps({
  api: { type: Object, default: null },
});

const { t } = useI18n();
const users = ref([]);
const loading = ref(false);
const error = ref("");

async function load() {
  if (!props.api) return;
  loading.value = true;
  error.value = "";
  try {
    const response = await props.api.users();
    users.value = response?.users || [];
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
      <el-button
        :icon="Refresh"
        :loading="loading"
        @click="load"
        >{{ $t("refresh") }}</el-button
      >
    </div>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
      class="mb"
    />

    <el-table
      :data="users"
      v-loading="loading"
      size="default"
      stripe
    >
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
      <el-table-column :label="$t('lastLogin')" width="170">
        <template #default="{ row }">
          <span class="muted">{{
            row.last_login_at
              ? new Date(row.last_login_at).toLocaleString()
              : "--"
          }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="$t('actions')" width="120" fixed="right">
        <template #default="{ row }">
          <el-button
            size="small"
            :type="row.status === 'active' ? 'danger' : 'success'"
            text
            @click="toggleStatus(row)"
            >{{
              row.status === "active" ? $t("banUser") : $t("unbanUser")
            }}</el-button
          >
        </template>
      </el-table-column>
      <template #empty>
        <span class="muted">{{ loading ? $t("syncing") : "--" }}</span>
      </template>
    </el-table>
  </section>
</template>
