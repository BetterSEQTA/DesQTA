<script lang="ts">
  interface Props {
    weatherData: {
      temperature: number;
      weathercode: number;
      location: string;
      country: string;
    };
  }

  let { weatherData }: Props = $props();
</script>

<div
  class="flex shrink-0 gap-2 items-center px-3 py-2 text-sm font-medium rounded-xl border backdrop-blur-md 2xl:gap-3 2xl:px-4 bg-white/60 border-zinc-200/40 dark:bg-zinc-800/60 dark:border-zinc-700/40"
  title="{weatherData.location}{weatherData.country ? `, ${weatherData.country}` : ''}">
  <div class="flex gap-2 items-center">
    <div
      class="flex justify-center items-center w-6 h-6 bg-yellow-100 rounded-lg dark:bg-yellow-900/30">
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        {#if weatherData.weathercode === 0}
          <!-- Clear -->
          <circle cx="12" cy="12" r="8" fill="#facc15" />
        {:else if weatherData.weathercode === 1 || weatherData.weathercode === 2}
          <!-- Partly Cloudy -->
          <ellipse cx="12" cy="15" rx="7" ry="4" fill="#a3a3a3" />
          <circle cx="16" cy="10" r="5" fill="#facc15" />
        {:else}
          <!-- Cloudy/Other -->
          <ellipse cx="12" cy="15" rx="7" ry="4" fill="#a3a3a3" />
        {/if}
      </svg>
    </div>
    <span class="font-semibold whitespace-nowrap text-zinc-900 dark:text-white"
      >{Math.round(weatherData.temperature)}°C</span>
  </div>
  <span
    class="hidden max-w-[8rem] truncate text-zinc-600 2xl:inline dark:text-zinc-400"
    >{weatherData.location}</span>
</div>