<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import { CopyDocument, Refresh, SwitchButton, User, Trophy } from "@element-plus/icons-vue";
import { fetchLeaderboard, fetchMe, loginUrl, logout, rotateKey } from "./auth";

const { t } = useI18n();
const me = ref(null);
const state = ref("loading"); // loading | anonymous | ready
const rotating = ref(false);
const confirmRotate = ref(false);
const issuedKey = ref("");
const copied = ref(false);

const metrics = computed(() =>
  me.value
    ? [
        {
          title: t("apiCalls"),
          value: me.value.usage_24h.api_calls,
          accent: true,
          foot: [t("usage24h")],
        },
        {
          title: t("tokens"),
          value: me.value.usage_24h.total_tokens,
          foot: [t("usage24h")],
        },
        {
          title: t("apiCalls"),
          value: me.value.usage_7d.api_calls,
          foot: [t("usage7d")],
        },
        {
          title: t("tokens"),
          value: me.value.usage_7d.total_tokens,
          foot: [t("usage7d")],
        },
      ]
    : [],
);

function avatarUrl(template) {
  if (!template) return "";
  const sized = template.includes("{size}")
    ? template.replace("{size}", 96)
    : template;
  if (sized.startsWith("http")) return sized;
  if (sized.startsWith("/")) return `https://linux.do${sized}`;
  return "";
}

function fmtTime(value) {
  return value ? new Date(value).toLocaleString() : "--";
}

async function load() {
  state.value = "loading";
  try {
    me.value = await fetchMe();
    state.value = "ready";
  } catch (error) {
    state.value = error?.status === 401 ? "anonymous" : "error";
  }
}

async function copyKey(text) {
  await navigator.clipboard.writeText(text);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}

async function doRotate() {
  rotating.value = true;
  try {
    const result = await rotateKey();
    issuedKey.value = result.api_key;
    confirmRotate.value = false;
    await load();
    ElMessage.success(t("rotateDone"));
  } catch (error) {
    ElMessage.error(String(error));
  } finally {
    rotating.value = false;
  }
}

async function signOut() {
  try {
    await logout();
  } catch {
    /* 会话可能已失效 */
  }
  window.location.href = "/";
}

// 今日用量排行榜
const board = ref(null);
const boardLoading = ref(false);
let boardTimer = null;

async function loadBoard() {
  boardLoading.value = true;
  try {
    board.value = await fetchLeaderboard();
  } catch {
    board.value = null; // 静默：排行榜是附加能力，失败不影响主视图
  } finally {
    boardLoading.value = false;
  }
}

const medal = (rank) => ({ 1: "🥇", 2: "🥈", 3: "🥉" }[rank] || rank);

// ≥10亿 用 B，≥100万 用 M，其余千分位；保留至多两位小数并去尾零
function fmtCount(n) {
  if (n >= 1e9) return Number((n / 1e9).toFixed(2)) + "B";
  if (n >= 1e6) return Number((n / 1e6).toFixed(2)) + "M";
  return n.toLocaleString();
}

onMounted(() => {
  load();
  loadBoard();
  boardTimer = setInterval(loadBoard, 60000);
});
onUnmounted(() => clearInterval(boardTimer));
</script>

<template>
  <section class="view-section user-view">
    <div class="page-heading">
      <div>
        <div class="overline">{{ $t("userCenter") }} / ACCOUNT</div>
        <h2>{{ $t("myKey") }}</h2>
        <p>{{ $t("loginPrompt") }}</p>
      </div>
      <el-button
        v-if="state === 'ready'"
        :icon="Refresh"
        :loading="state === 'loading'"
        @click="load"
        >{{ $t("refresh") }}</el-button
      >
    </div>

    <div v-if="state === 'loading'" class="user-empty muted">
      {{ $t("syncing") }}
    </div>

    <el-card v-else-if="state === 'anonymous'" class="login-card" shadow="never">
      <div class="login-hero">
        <el-icon :size="40" color="var(--oce-teal)"><User /></el-icon>
        <h3>{{ $t("loginWithLinuxDo") }}</h3>
        <p class="muted">{{ $t("loginPrompt") }}</p>
        <el-button type="primary" size="large" tag="a" :href="loginUrl()">
          {{ $t("loginWithLinuxDo") }}
        </el-button>
      </div>
    </el-card>

    <el-alert
      v-else-if="state === 'error'"
      :title="$t('loadFailed')"
      type="error"
      :closable="false"
      show-icon
    />

    <template v-else>
      <!-- 账号横幅 -->
      <el-card class="profile-card" shadow="never">
        <div class="profile-row">
          <el-avatar
            :size="64"
            :src="avatarUrl(me.user.avatar_template)"
          >
            <el-icon :size="28"><User /></el-icon>
          </el-avatar>
          <div class="profile-meta">
            <div class="profile-name">
              <strong>{{ me.user.name || me.user.username }}</strong>
              <el-tag effect="dark" size="small" round>TL{{ me.user.trust_level }}</el-tag>
            </div>
            <small class="muted">@{{ me.user.username }} · LinuxDo</small>
          </div>
          <div class="profile-actions">
            <span class="muted small"
              >{{ $t("lastLogin") }}: {{ fmtTime(me.user.last_login_at) }}</span
            >
            <el-button text :icon="SwitchButton" @click="signOut">{{
              $t("logout")
            }}</el-button>
          </div>
        </div>
      </el-card>

      <!-- 用量统计：与运维总览同款 metric 卡 -->
      <el-row :gutter="14" class="metric-row">
        <el-col v-for="(item, index) in metrics" :key="index" :xs="12" :sm="6">
          <el-card class="metric-card" :class="{ accent: item.accent }" shadow="never">
            <el-statistic :title="item.title" :value="item.value" group-separator="," />
            <div class="metric-foot">
              <span>{{ item.foot[0] }}</span>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- Key 常显卡 -->
      <el-alert
        v-if="issuedKey"
        :title="$t('rotateNotice')"
        type="success"
        closable
        show-icon
        class="mb"
        @close="issuedKey = ''"
      />
      <el-card class="key-card" shadow="never">
        <template #header>
          <div class="card-header-row">
            <span class="overline">API KEY</span>
            <el-tag
              v-if="me.api_key"
              :type="me.api_key.status === 'active' ? 'success' : 'info'"
              size="small"
              effect="plain"
              >{{ me.api_key.status }}</el-tag
            >
          </div>
        </template>

        <template v-if="me.api_key && me.api_key.api_key">
          <div class="key-display">
            <code>{{ me.api_key.api_key }}</code>
            <el-button
              type="primary"
              plain
              :icon="CopyDocument"
              @click="copyKey(me.api_key.api_key)"
              >{{ copied ? $t("copied") : $t("copy") }}</el-button
            >
          </div>
          <el-descriptions class="key-meta" :column="3" size="small">
            <el-descriptions-item :label="$t('keyLast4')">
              <code>••••{{ me.api_key.key_last4 }}</code>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('createdAt')">{{
              fmtTime(me.api_key.created_at)
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('lastUsed')">{{
              fmtTime(me.api_key.last_used_at)
            }}</el-descriptions-item>
          </el-descriptions>
          <div class="key-actions">
            <template v-if="confirmRotate">
              <span class="muted small">{{ $t("confirmRotate") }}</span>
              <el-button type="danger" :loading="rotating" @click="doRotate">{{
                $t("confirmRotate")
              }}</el-button>
              <el-button text @click="confirmRotate = false">{{
                $t("cancel")
              }}</el-button>
            </template>
            <el-button v-else @click="confirmRotate = true">{{
              $t("rotateKey")
            }}</el-button>
          </div>
        </template>

        <template v-else-if="me.api_key">
          <div class="key-legacy">
            <p class="muted">{{ $t("legacyKeyHint") }}</p>
            <el-button :loading="rotating" @click="doRotate">{{
              $t("rotateToReveal")
            }}</el-button>
          </div>
        </template>

        <p v-else class="muted">{{ $t("noKey") }}</p>
      </el-card>

      <!-- 今日用量排行榜 -->
      <el-card v-if="state === 'ready'" class="board-card" shadow="never" v-loading="boardLoading && !board">
        <template #header>
          <div class="card-header-row">
            <span class="board-title">
              <el-icon><Trophy /></el-icon>
              {{ $t("leaderboardTitle") }}
              <el-tag v-if="board" size="small" effect="plain">{{ board.day }}</el-tag>
            </span>
            <el-button text :icon="Refresh" :loading="boardLoading" @click="loadBoard">{{
              $t("refresh")
            }}</el-button>
          </div>
        </template>
        <template v-if="board && board.entries.length">
          <el-table
            :data="board.entries"
            size="small"
            :row-class-name="({ row }) => (me && row.user_id === me.user.id ? 'lb-me' : '')"
          >
            <el-table-column :label="$t('rank')" width="70" align="center">
              <template #default="{ row }">
                <span class="lb-rank">{{ medal(row.rank) }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="$t('username')" min-width="160">
              <template #default="{ row }">
                <strong>{{ row.name || row.username }}</strong>
                <small class="muted block">@{{ row.username }}</small>
              </template>
            </el-table-column>
            <el-table-column :label="$t('apiCalls')" width="110" align="right">
              <template #default="{ row }">{{ fmtCount(row.api_calls) }}</template>
            </el-table-column>
            <el-table-column :label="$t('tokens')" width="130" align="right">
              <template #default="{ row }">{{ fmtCount(row.total_tokens) }}</template>
            </el-table-column>
          </el-table>
          <div class="board-foot">
            <template v-if="board.me">
              <el-tag type="warning" effect="plain" size="small">{{ $t("lbMe") }}</el-tag>
              {{ $t("lbMeRank", { rank: board.me.rank, total: board.total_users }) }}
            </template>
            <span v-else class="muted">{{ $t("lbNoUsageMe") }}</span>
          </div>
        </template>
        <el-empty v-else-if="board" :description="$t('lbEmpty')" :image-size="60" />
      </el-card>
    </template>
  </section>
</template>
