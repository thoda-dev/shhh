<script setup lang="ts">
import { TableKit } from '@tiptap/extension-table'
import type { Editor } from '@tiptap/vue-3'
import type { EditorToolbarItem } from '@nuxt/ui'

const value = defineModel<string>({ required: true })

const { t } = useI18n()
const editorRef = useTemplateRef('editorRef')

/**
 * Keeps the browser out of the content. A spellchecker, Grammarly or Chrome's translate offer — likely wherever the interface is in one language and the text in another — mutates the DOM behind ProseMirror's back, which throws and takes the content with it.
 */
const editorProps = {
  attributes: {
    'data-gramm': 'false',
    'data-gramm_editor': 'false',
    'data-enable-grammarly': 'false',
    'spellcheck': 'false',
    'translate': 'no'
  },
  // A node inserted by anything but ProseMirror itself is not ours to reconcile.
  ignoreMutation: (mutation: MutationRecord | { type: 'selection', target: Element }) => {
    if (mutation.type !== 'childList') return false
    return Array.from(mutation.addedNodes).some(node => !('__pmViewDesc' in node))
  }
}

// Tables are the only thing StarterKit lacks that is worth having here. Nothing else is added: an editor must not offer what Markdown cannot carry back.
const extensions = [TableKit.configure({ table: { resizable: false } })]

const handlers = {
  insertTable: {
    canExecute: () => true,
    execute: (editor: Editor) => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }),
    isActive: (editor: Editor) => editor.isActive('table'),
    isDisabled: undefined
  }
}

const tip = (key: string) => ({ text: t(`editor.${key}`), delayDuration: 0 })

// Every entry here survives a Markdown round trip — see tests/editor-roundtrip.test.ts. Task lists do not (the checkbox is dropped on save), images cannot be hosted, and alignment has no Markdown to carry it, so none of the three is offered.
const items = computed<EditorToolbarItem[][]>(() => [
  [
    { kind: 'undo', icon: 'i-lucide-undo-2', tooltip: tip('undo') },
    { kind: 'redo', icon: 'i-lucide-redo-2', tooltip: tip('redo') }
  ],
  [
    { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: tip('bold') },
    { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: tip('italic') },
    { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: tip('strike') },
    { kind: 'code', icon: 'i-lucide-code', tooltip: tip('code') }
  ],
  [
    { kind: 'paragraph', icon: 'i-lucide-pilcrow', tooltip: tip('paragraph') },
    { kind: 'heading', level: 1, icon: 'i-lucide-heading-1', tooltip: tip('heading1') },
    { kind: 'heading', level: 2, icon: 'i-lucide-heading-2', tooltip: tip('heading2') },
    { kind: 'heading', level: 3, icon: 'i-lucide-heading-3', tooltip: tip('heading3') }
  ],
  [
    { kind: 'bulletList', icon: 'i-lucide-list', tooltip: tip('bulletList') },
    { kind: 'orderedList', icon: 'i-lucide-list-ordered', tooltip: tip('orderedList') }
  ],
  [
    { kind: 'blockquote', icon: 'i-lucide-quote', tooltip: tip('blockquote') },
    { kind: 'codeBlock', icon: 'i-lucide-square-code', tooltip: tip('codeBlock') },
    { kind: 'link', icon: 'i-lucide-link', tooltip: tip('link') },
    { kind: 'horizontalRule', icon: 'i-lucide-minus', tooltip: tip('horizontalRule') }
  ],
  [
    { kind: 'insertTable', icon: 'i-lucide-table', tooltip: tip('insertTable') },
    { kind: 'clearFormatting', icon: 'i-lucide-remove-formatting', tooltip: tip('clearFormatting') }
  ]
])

function run(command: (chain: ReturnType<Editor['chain']>) => { run: () => boolean }) {
  const editor = editorRef.value?.editor
  if (editor) command(editor.chain().focus()).run()
}

const tableItems = computed<EditorToolbarItem[][]>(() => [
  [
    { icon: 'i-lucide-between-vertical-start', variant: 'ghost', color: 'neutral', tooltip: { text: t('editor.columnBefore'), delayDuration: 0 }, onClick: () => run(c => c.addColumnBefore()) },
    { icon: 'i-lucide-between-vertical-end', variant: 'ghost', color: 'neutral', tooltip: { text: t('editor.columnAfter'), delayDuration: 0 }, onClick: () => run(c => c.addColumnAfter()) },
    { icon: 'i-lucide-square-minus', variant: 'ghost', color: 'error', tooltip: { text: t('editor.deleteColumn'), delayDuration: 0 }, onClick: () => run(c => c.deleteColumn()) }
  ],
  [
    { icon: 'i-lucide-between-horizontal-start', variant: 'ghost', color: 'neutral', tooltip: { text: t('editor.rowBefore'), delayDuration: 0 }, onClick: () => run(c => c.addRowBefore()) },
    { icon: 'i-lucide-between-horizontal-end', variant: 'ghost', color: 'neutral', tooltip: { text: t('editor.rowAfter'), delayDuration: 0 }, onClick: () => run(c => c.addRowAfter()) },
    { icon: 'i-lucide-square-minus', variant: 'ghost', color: 'error', tooltip: { text: t('editor.deleteRow'), delayDuration: 0 }, onClick: () => run(c => c.deleteRow()) }
  ],
  [
    { icon: 'i-lucide-trash-2', variant: 'ghost', color: 'error', tooltip: { text: t('editor.deleteTable'), delayDuration: 0 }, onClick: () => run(c => c.deleteTable()) }
  ]
])
</script>

<template>
  <UEditor
    ref="editorRef"
    v-slot="{ editor }"
    v-model="value"
    content-type="markdown"
    :image="false"
    :mention="false"
    :extensions="extensions"
    :handlers="handlers"
    :editor-props="editorProps"
    :ui="{ base: 'rich-text p-4', content: 'relative w-full' }"
    class="overflow-y-auto rounded-md border border-default"
  >
    <UEditorToolbar
      :editor="editor"
      :items="items"
      class="sticky top-0 z-10 border-b border-default bg-default px-4 py-2"
    />
    <UEditorToolbar
      :editor="editor"
      :should-show="() => editor.isActive('table')"
      :items="tableItems"
      layout="bubble"
      :tippy-options="{ placement: 'bottom', offset: [0, 8] }"
    />
  </UEditor>
</template>
