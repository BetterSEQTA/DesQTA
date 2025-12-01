<script lang="ts">
  import { locale, availableLocales } from '../i18n';
  import { invoke } from '@tauri-apps/api/core';
  import { logger } from '../../utils/logger';
  import { Icon, ChevronDown } from 'svelte-hero-icons'; // Removed GlobeAlt
  
  interface Props {
    compact?: boolean;
    showFlags?: boolean;
  }
  
  let { compact = false, showFlags = true }: Props = $props();
  
  const changeLanguage = async (languageCode: string) => {
    try {
      locale.set(languageCode);
      const { saveSettingsWithQueue } = await import('../services/settingsSync');
      await saveSettingsWithQueue({ language: languageCode });
      logger.info('LanguageSelector', 'changeLanguage', `Language changed to ${languageCode}`);
    } catch (e) {
      logger.error('LanguageSelector', 'changeLanguage', `Failed to save language preference: ${e}`, { error: e });
    }
  };
  
  const getCurrentLocale = () => {
    let currentLocale: string;
    const unsubscribe = locale.subscribe(value => {
      currentLocale = value || 'en';
    });
    unsubscribe();
    return availableLocales.find(l => l.code === currentLocale) || availableLocales[0];
  };
  
  let currentLocaleInfo = $derived(getCurrentLocale());
</script>

<div class="relative">

  <!-- Select dropdown (hover stays EXACTLY the same as before) -->
  <select
    bind:value={$locale}
    onchange={(e) => changeLanguage((e.target as HTMLSelectElement).value)}
    class="
      appearance-none cursor-pointer
      {compact 
        ? 'pl-10 pr-8 py-2 text-sm min-w-[90px]' 
        : 'px-4 py-3 text-base min-w-[140px] pr-12'
      }
      bg-white/80 dark:bg-zinc-800/80
      backdrop-blur-xl
      border-2 border-zinc-200/60 dark:border-zinc-600/60
      rounded-xl
      text-zinc-900 dark:text-zinc-100
      font-medium
      shadow-lg dark:shadow-zinc-900/20
      transition-all duration-200 ease-out

      hover:bg-white/90 dark:hover:bg-zinc-700/90
      hover:border-indigo-400/80 dark:hover:border-indigo-500/80
      hover:shadow-xl
      hover:scale-[1.02]

      focus:outline-none 
      focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-400/50
      focus:ring-offset-2 dark:focus:ring-offset-zinc-800
      focus:border-indigo-500 dark:focus:border-indigo-400
      focus:bg-white dark:focus:bg-zinc-700
      focus:scale-[1.02]
    "
  >
    {#each availableLocales as localeOption}
      <option 
        value={localeOption.code}
        class="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 py-2"
      >
        {#if showFlags && !compact}
          {localeOption.flag} {localeOption.name}
        {:else if showFlags}
          {localeOption.flag} {localeOption.code.toUpperCase()}
        {:else}
          {localeOption.name}
        {/if}
      </option>
    {/each}
  </select>

  <!-- RIGHT SIDE ICON (only chevron now, globe removed) -->
  <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
    <div class="flex items-center">
      <Icon 
        src={ChevronDown} 
        class="w-4 h-4 text-zinc-600 dark:text-zinc-300 transition-transform duration-200" 
      />
    </div>
  </div>

  <!-- Compact mode left-side icon -->
  {#if compact}
    <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <span class="text-lg">
        {currentLocaleInfo.flag}
      </span>
    </div>
  {/if}
</div>
