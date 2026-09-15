<script setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { CopyDocument } from "@element-plus/icons-vue";

const { t } = useI18n();
const HOST = window.location.origin;

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

    <el-card shadow="never" class="mb">
      <p class="connect-lede">
        {{ $t("guideIntro") }}
      </p>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header>{{ $t("guideCliPosix") }}</template>
      <div class="codeblock">
        <el-button
          class="copy-btn"
          size="small"
          text
          :icon="CopyDocument"
          @click="copy('cliPosix', blocks.cliPosix)"
          >{{ copiedKey === "cliPosix" ? $t("copied") : $t("copy") }}</el-button
        >
        <pre><code>{{ blocks.cliPosix }}</code></pre>
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
          @click="copy('cliWindows', blocks.cliWindows)"
          >{{
            copiedKey === "cliWindows" ? $t("copied") : $t("copy")
          }}</el-button>
        <pre><code>{{ blocks.cliWindows }}</code></pre>
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
          @click="copy('mcpWindows', blocks.mcpWindows)"
          >{{
            copiedKey === "mcpWindows" ? $t("copied") : $t("copy")
          }}</el-button>
        <pre><code>{{ blocks.mcpWindows }}</code></pre>
      </div>
      <div class="codeblock">
        <el-button
          class="copy-btn"
          size="small"
          text
          :icon="CopyDocument"
          @click="copy('mcpPosix', blocks.mcpPosix)"
          >{{
            copiedKey === "mcpPosix" ? $t("copied") : $t("copy")
          }}</el-button>
        <pre><code>{{ blocks.mcpPosix }}</code></pre>
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
          <code>OCE_API_KEY=&lt;你的APIKey&gt;</code>
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
          @click="copy('healthCheck', blocks.healthCheck)"
          >{{
            copiedKey === "healthCheck" ? $t("copied") : $t("copy")
          }}</el-button>
        <pre><code>{{ blocks.healthCheck }}</code></pre>
      </div>
      <p class="muted small">{{ $t("guideKeyHint") }}</p>
    </el-card>
  </section>
</template>
