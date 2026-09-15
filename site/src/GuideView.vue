<script setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { CopyDocument } from "@element-plus/icons-vue";
import { fetchMe, loginUrl } from "./auth";

const { t } = useI18n();
const HOST = window.location.origin;
// 登录后 <你的APIKey> 占位符自动替换为当前 key（复制内容同步替换）
const myKey = ref(null);
const keyReady = ref(false);
const signedIn = ref(false);

onMounted(async () => {
  try {
    const me = await fetchMe();
    myKey.value = me.api_key?.api_key || null;
    signedIn.value = true;
  } catch {
    myKey.value = null;
    signedIn.value = false;
  } finally {
    keyReady.value = true;
  }
});

function withKey(text) {
  return myKey.value ? text.replaceAll("<你的APIKey>", myKey.value) : text;
}

const blocks = {
  cliPosix: `uv tool install opencontextengine-client

export OCE_API_URL="${HOST}"
export OCE_API_KEY="<你的APIKey>"

cd ~/my-project
oce-client sync
oce-client retrieve "认证是在哪里实现的？"`,
  cliWindows: `winget install astral-sh.uv
uv tool install "opencontextengine-client[mcp]"

$env:OCE_API_URL = "${HOST}"
$env:OCE_API_KEY = "<你的APIKey>"

cd C:\\src\\my-project
oce-client sync`,
  mcpWindows: `claude mcp add oce --scope user \`
  -e OCE_API_URL=${HOST} \`
  -e OCE_API_KEY=<你的APIKey> \`
  -- oce-client-mcp --workspace "C:\\src\\my-project"`,
  mcpPosix: `claude mcp add oce --scope user \\
  -e OCE_API_URL=${HOST} \\
  -e OCE_API_KEY=<你的APIKey> \\
  -- oce-client-mcp --workspace /path/to/project`,
  healthCheck: `curl -s ${HOST}/health`,
};

const copiedKey = ref("");

async function copy(name, text) {
  await navigator.clipboard.writeText(text);
  copiedKey.value = name;
  setTimeout(() => (copiedKey.value = ""), 1500);
}
</script>

<template>
  <section class="view-section guide-view">
    <div class="page-heading">
      <div>
        <div class="overline">{{ $t("userCenter") }}</div>
        <h2>{{ $t("guide") }}</h2>
      </div>
    </div>

    <el-card v-if="keyReady && !signedIn" shadow="never">
      <div class="login-hero">
        <h3>{{ $t("guideLoginRequired") }}</h3>
        <p class="muted">{{ $t("loginPrompt") }}</p>
        <el-button type="primary" size="large" tag="a" :href="loginUrl()">
          {{ $t("loginWithLinuxDo") }}
        </el-button>
      </div>
    </el-card>

    <template v-else>
    <el-card shadow="never" class="mb">
      <el-alert
        v-if="keyReady && myKey"
        :title="$t('guideKeyInjected')"
        type="success"
        :closable="false"
        show-icon
      />
      <el-alert
        v-else-if="keyReady"
        :title="$t('guideKeyNotReady')"
        type="info"
        :closable="false"
        show-icon
      />
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header>{{ $t("guideCliPosix") }}</template>
      <div class="codeblock">
        <el-button
          class="copy-btn"
          size="small"
          text
          :icon="CopyDocument"
          @click="copy('cliPosix', withKey(blocks.cliPosix))"
          >{{ copiedKey === "cliPosix" ? $t("copied") : $t("copy") }}</el-button
        >
        <pre><code>{{ withKey(blocks.cliPosix) }}</code></pre>
      </div>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header>{{ $t("guideCliWindows") }}</template>
      <div class="codeblock">
        <el-button
          class="copy-btn"
          size="small"
          text
          :icon="CopyDocument"
          @click="copy('cliWindows', withKey(blocks.cliWindows))"
          >{{
            copiedKey === "cliWindows" ? $t("copied") : $t("copy")
          }}</el-button>
        <pre><code>{{ withKey(blocks.cliWindows) }}</code></pre>
      </div>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header>{{ $t("guideMcpClaude") }}</template>
      <div class="codeblock">
        <el-button
          class="copy-btn"
          size="small"
          text
          :icon="CopyDocument"
          @click="copy('mcpWindows', withKey(blocks.mcpWindows))"
          >{{
            copiedKey === "mcpWindows" ? $t("copied") : $t("copy")
          }}</el-button>
        <pre><code>{{ withKey(blocks.mcpWindows) }}</code></pre>
      </div>
      <div class="codeblock">
        <el-button
          class="copy-btn"
          size="small"
          text
          :icon="CopyDocument"
          @click="copy('mcpPosix', withKey(blocks.mcpPosix))"
          >{{
            copiedKey === "mcpPosix" ? $t("copied") : $t("copy")
          }}</el-button>
        <pre><code>{{ withKey(blocks.mcpPosix) }}</code></pre>
      </div>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header>{{ $t("guideMcpCursor") }}</template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="Command"
          ><code>oce-client-mcp</code></el-descriptions-item
        >
        <el-descriptions-item label="Args"
          ><code>--workspace &lt;项目路径&gt;</code></el-descriptions-item
        >
        <el-descriptions-item label="Env">
          <code>OCE_API_URL={{ HOST }}</code><br />
          <code>OCE_API_KEY={{ myKey || "<你的APIKey>" }}</code>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never">
      <template #header>{{ $t("guideHealth") }}</template>
      <div class="codeblock">
        <el-button
          class="copy-btn"
          size="small"
          text
          :icon="CopyDocument"
          @click="copy('healthCheck', withKey(blocks.healthCheck))"
          >{{
            copiedKey === "healthCheck" ? $t("copied") : $t("copy")
          }}</el-button>
        <pre><code>{{ withKey(blocks.healthCheck) }}</code></pre>
      </div>
      <p class="muted small">{{ $t("guideKeyHint") }}</p>
    </el-card>
    </template>
  </section>
</template>
