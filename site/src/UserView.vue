<script setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import { CopyDocument, Refresh, User } from "@element-plus/icons-vue";
import { fetchMe, loginUrl, rotateKey } from "./auth";

const { t } = useI18n();
const me = ref(null);
const state = ref("loading"); // loading | anonymous | ready
const rotating = ref(false);
const confirmRotate = ref(false);
const issuedKey = ref("");
const copied = ref(false);

const usageWindows = computed(() =>
  me.value
    ? [
        {
          label: t("usage24h"),
          calls: me.value.usage_24h.api_calls,
          tokens: me.value.usage_24h.total_tokens,
        },
        {
          label: t("usage7d"),
          calls: me.value.usage_7d.api_calls,
          tokens: me.value.usage_7d.total_tokens,
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

onMounted(load);
</script>

<template>
  <section v-show="true" class="view-section user-view">
    <div class="page-heading">
      <div>
        <div class="overline">{{ $t("userCenter") }}</div>
        <h2>{{ $t("myKey") }}</h2>
      </div>
    </div>

    <div v-if="state === 'loading'" class="muted">{{ $t("loading") }}</div>

    <el-card v-else-if="state === 'anonymous'" shadow="never" class="login-card">
      <p class="connect-lede">{{ $t("loginPrompt") }}</p>
      <el-button type="primary" size="large" tag="a" :href="loginUrl()">
        {{ $t("loginWithLinuxDo") }}
      </el-button>
    </el-card>

    <el-alert
      v-else-if="state === 'error'"
      :title="$t('loadFailed')"
      type="error"
      :closable="false"
      show-icon
    />

    <template v-else>
      <el-alert
        v-if="issuedKey"
        :title="$t('rotateNotice')"
        type="success"
        :closable="true"
        show-icon
        class="mb"
        @close="issuedKey = ''"
      />

      <div class="user-grid">
        <el-card shadow="never">
          <template #header>
            <div class="card-header-row">
              <span>{{ $t("account") }}</span>
            </div>
          </template>
          <div class="user-row">
            <el-avatar :size="56" :src="avatarUrl(me.user.avatar_template)">
              <el-icon :size="24"><User /></el-icon>
            </el-avatar>
            <div class="user-meta">
              <strong>{{ me.user.name || me.user.username }}</strong>
              <small class="muted">@{{ me.user.username }}</small>
            </div>
            <el-tag effect="plain" round>TL{{ me.user.trust_level }}</el-tag>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="card-header-row">
              <span>{{ $t("apiKey") }}</span>
              <el-tag
                v-if="me.api_key"
                :type="me.api_key.status === 'active' ? 'success' : 'info'"
                size="small"
                >{{ me.api_key.status }}</el-tag
              >
            </div>
          </template>
          <template v-if="me.api_key && me.api_key.api_key">
            <div class="key-line">
              <code class="key-plaintext">{{ me.api_key.api_key }}</code>
              <el-button
                size="small"
                :icon="CopyDocument"
                @click="copyKey(me.api_key.api_key)"
                >{{ copied ? $t("copied") : $t("copy") }}</el-button
              >
            </div>
            <div class="key-actions">
              <template v-if="confirmRotate">
                <el-button
                  type="danger"
                  :loading="rotating"
                  @click="doRotate"
                  >{{ $t("confirmRotate") }}</el-button
                >
                <el-button text @click="confirmRotate = false">{{
                  $t("cancel")
                }}</el-button>
              </template>
              <el-button v-else @click="confirmRotate = true"
                >{{ $t("rotateKey") }}</el-button
              >
            </div>
          </template>
          <template v-else-if="me.api_key">
            <p class="muted">{{ $t("legacyKeyHint") }}</p>
            <el-button :loading="rotating" @click="doRotate">{{
              $t("rotateToReveal")
            }}</el-button>
          </template>
          <p v-else class="muted">{{ $t("noKey") }}</p>
        </el-card>

        <el-card
          v-for="window in usageWindows"
          :key="window.label"
          shadow="never"
        >
          <template #header>{{ window.label }}</template>
          <div class="usage-row">
            <div class="usage-cell">
              <strong>{{ window.calls }}</strong>
              <small class="muted">{{ $t("apiCalls") }}</small>
            </div>
            <div class="usage-cell">
              <strong>{{ window.tokens.toLocaleString() }}</strong>
              <small class="muted">{{ $t("tokens") }}</small>
            </div>
          </div>
        </el-card>
      </div>

      <div class="user-actions">
        <el-button :icon="Refresh" text @click="load">{{
          $t("refresh")
        }}</el-button>
        <el-button text tag="a" href="#guide" class="muted">{{
          $t("guide")
        }}</el-button>
      </div>
    </template>
  </section>
</template>
