<script lang="ts">
  import T from '$lib/components/T.svelte';

  export interface SettingsSectionItem {
    id: string;
    labelKey: string;
    fallback: string;
  }

  interface Props {
    sections: SettingsSectionItem[];
    activeId: string | null;
    variant: 'sidebar' | 'chips';
    onNavigate: (id: string) => void;
  }

  let { sections, activeId, variant, onNavigate }: Props = $props();
</script>

{#if variant === 'sidebar'}
  <aside class="hidden xl:block w-56 shrink-0 self-start sticky top-20 z-10">
    <nav
      class="rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 bg-white/80 dark:bg-zinc-900/60 shadow-lg overflow-hidden backdrop-blur-md"
      aria-label="Settings sections">
      <div class="px-4 py-3 border-b border-zinc-200/50 dark:border-zinc-700/50">
        <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <T key="settings.sections_title" fallback="Sections" />
        </p>
      </div>
      <ul class="p-2 space-y-0.5 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain">
        {#each sections as section (section.id)}
          <li>
            <button
              type="button"
              class="w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-200 border-l-2 {activeId ===
              section.id
                ? 'border-[var(--accent)] accent-text bg-[var(--accent)]/10 font-medium'
                : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200'}"
              onclick={() => onNavigate(section.id)}
              aria-current={activeId === section.id ? 'true' : undefined}>
              <T key={section.labelKey} fallback={section.fallback} />
            </button>
          </li>
        {/each}
      </ul>
    </nav>
  </aside>
{:else}
  <nav
    class="xl:hidden -mx-1 px-1 pb-3 mb-2 overflow-x-auto overscroll-x-contain flex gap-2"
    aria-label="Settings sections">
    {#each sections as section (section.id)}
      <button
        type="button"
        class="shrink-0 whitespace-nowrap min-h-[44px] px-4 py-2 text-sm rounded-full border transition-all duration-200 {activeId ===
        section.id
          ? 'border-[var(--accent)] bg-[var(--accent)] text-white font-medium shadow-sm'
          : 'border-zinc-200/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'}"
        onclick={() => onNavigate(section.id)}
        aria-current={activeId === section.id ? 'true' : undefined}>
        <T key={section.labelKey} fallback={section.fallback} />
      </button>
    {/each}
  </nav>
{/if}
