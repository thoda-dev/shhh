<script setup lang="ts">
const runtimeConfig = useRuntimeConfig()
const toast = useToast()

// Kept in step with `mcp.name` in nuxt.config.ts, which the module does not expose to the client.
const serverName = 'shhh docs'

const route = (runtimeConfig.public.mcp as { route?: string } | undefined)?.route || '/mcp'
const serverUrl = `${useRequestURL().origin}${route}`
const copied = ref(false)

// Cursor and VS Code go through the module's own deeplink route; claude.ai only pre-fills its
// dialog, so the user still confirms the URL there — by design, the link comes from outside.
const claudeUrl = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(serverName)}&connectorUrl=${encodeURIComponent(serverUrl)}`

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(serverUrl)
  } catch {
    // There is no clipboard outside a secure context, which a docs instance on plain HTTP is not.
    toast.add({
      title: 'Could not copy',
      description: 'Select the URL above and copy it by hand.',
      icon: 'i-lucide-triangle-alert',
      color: 'warning',
    })
    return
  }

  copied.value = true
  setTimeout(() => copied.value = false, 2000)
  toast.add({ title: 'Server URL copied', icon: 'i-lucide-check-circle', color: 'success' })
}
</script>

<template>
  <div class="my-5 flex flex-col gap-4 rounded-lg border border-default bg-elevated/50 p-4">
    <div class="flex items-center gap-2">
      <code class="min-w-0 flex-1 truncate rounded-md bg-default px-3 py-2 font-mono text-sm text-highlighted ring ring-accented">{{ serverUrl }}</code>

      <UButton
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        color="neutral"
        variant="subtle"
        aria-label="Copy the MCP server URL"
        @click="copyUrl"
      />
    </div>

    <div class="flex flex-wrap gap-2">
      <UButton
        icon="i-simple-icons-claude"
        color="neutral"
        variant="outline"
        :to="claudeUrl"
        external
        target="_blank"
      >
        Add to Claude
      </UButton>

      <UButton
        icon="i-simple-icons-cursor"
        color="neutral"
        variant="outline"
        :to="`${route}/deeplink?ide=cursor`"
        external
        target="_blank"
      >
        Add to Cursor
      </UButton>

      <UButton
        icon="i-vscode-icons-file-type-vscode"
        color="neutral"
        variant="outline"
        :to="`${route}/deeplink?ide=vscode`"
        external
        target="_blank"
      >
        Add to VS Code
      </UButton>
    </div>
  </div>
</template>
