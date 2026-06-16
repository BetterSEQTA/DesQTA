<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { Icon, Cloud } from 'svelte-hero-icons';
  import { weatherService, resolveWeatherLocation } from '../../services/weatherService';
  import type { WeatherData, ForecastDay } from '../../services/weatherService';
  import { logger } from '../../../utils/logger';

  interface Props {
    widget?: any;
    settings?: Record<string, any>;
  }

  let { widget, settings = {} }: Props = $props();

  let weatherData = $state<WeatherData | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const location = $derived(settings.location || '');
  const units = $derived(settings.units || 'celsius');
  const showForecast = $derived(settings.showForecast !== false);

  function getWeatherIcon(code: number): string {
    if (code === 0) return '☀️'; // Clear
    if (code === 1 || code === 2) return '⛅'; // Partly cloudy
    if (code === 3) return '☁️'; // Overcast
    if (code >= 45 && code <= 48) return '🌫️'; // Fog
    if (code >= 51 && code <= 67) return '🌧️'; // Rain
    if (code >= 71 && code <= 77) return '🌨️'; // Snow
    if (code >= 80 && code <= 82) return '⛈️'; // Rain showers
    if (code >= 85 && code <= 86) return '🌨️'; // Snow showers
    if (code >= 95 && code <= 99) return '⛈️'; // Thunderstorm
    return '☁️';
  }

  function convertTemperature(temp: number): number {
    if (units === 'fahrenheit') {
      return Math.round((temp * 9) / 5 + 32);
    }
    return Math.round(temp);
  }

  function getTemperatureUnit(): string {
    return units === 'fahrenheit' ? '°F' : '°C';
  }

  function formatForecastDate(isoDate: string): string {
    const d = new Date(isoDate + 'T12:00:00');
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }

  async function loadWeather() {
    loading = true;
    error = null;
    try {
      const globalSettings = await weatherService.loadWeatherSettings();

      if (location) {
        const [city, country] = location.split(',').map((s: string) => s.trim());
        const resolved = resolveWeatherLocation(city, country);
        weatherData = await weatherService.fetchWeather(resolved.city, resolved.country);
      } else if (globalSettings.force_use_location) {
        weatherData = await weatherService.fetchWeather(
          globalSettings.weather_city,
          globalSettings.weather_country ?? '',
        );
      } else {
        weatherData = await weatherService.fetchWeatherWithIP();
      }

      if (!weatherData) {
        error = 'Unable to load weather data';
      }
    } catch (e) {
      logger.error('WeatherWidget', 'loadWeather', `Failed to load weather: ${e}`, { error: e });
      error = 'Failed to load weather';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadWeather();
  });

  // Reload when settings change
  $effect(() => {
    if (location || !location) {
      loadWeather();
    }
  });
</script>

<div class="flex flex-col h-full min-h-0 w-full">
  <div
    class="flex items-center gap-2 mb-2 sm:mb-3 shrink-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
    in:fade={{ duration: 200, delay: 0 }}
    style="transform-origin: left center;">
    <div
      class="transition-all duration-300"
      in:scale={{ duration: 300, delay: 100, easing: cubicInOut, start: 0.8 }}>
      <Icon
        src={Cloud}
        class="w-4 h-4 sm:w-5 sm:h-5 text-accent-600 dark:text-accent-400 transition-all duration-300" />
    </div>
    <h3
      class="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white transition-all duration-300"
      in:fade={{ duration: 300, delay: 150 }}>
      Weather
    </h3>
  </div>

  {#if loading}
    <div
      class="flex flex-col items-center justify-center flex-1 py-6 sm:py-8 min-h-0"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <div
        class="w-6 h-6 sm:w-8 sm:h-8 border-4 border-accent-600 border-t-transparent rounded-full animate-spin mb-2 transition-all duration-300"
        in:scale={{ duration: 400, easing: cubicInOut, start: 0.5 }}>
      </div>
      <p
        class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 transition-all duration-300"
        in:fade={{ duration: 300, delay: 100 }}>
        Loading weather...
      </p>
    </div>
  {:else if error}
    <div
      class="flex flex-col items-center justify-center flex-1 py-6 sm:py-8 min-h-0"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <p class="text-xs sm:text-sm text-red-600 dark:text-red-400">{error}</p>
      <button
        onclick={loadWeather}
        class="mt-2 px-3 py-1.5 text-xs rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-105 active:scale-95"
        in:fade={{ duration: 200, delay: 150 }}>
        Retry
      </button>
    </div>
  {:else if weatherData}
    <div
      class="flex flex-col gap-3 sm:gap-4 flex-1 min-h-0 w-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
      in:fade={{ duration: 400, delay: 100 }}
      style="transform-origin: center center;">
      <!-- Current Weather -->
      <div
        class="flex items-center gap-3 sm:gap-4 transition-all duration-300"
        in:fade={{ duration: 300, delay: 150 }}>
        <div
          class="text-3xl sm:text-4xl transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
          in:scale={{ duration: 500, delay: 200, easing: cubicInOut, start: 0.5 }}>
          {getWeatherIcon(weatherData.weathercode)}
        </div>
        <div class="flex-1">
          <div
            class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white transition-all duration-300">
            {convertTemperature(weatherData.temperature)}{getTemperatureUnit()}
          </div>
          <div
            class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 transition-all duration-300">
            {weatherData.location}, {weatherData.country}
          </div>
        </div>
      </div>

      {#if showForecast && weatherData.forecast?.length}
        <div
          class="pt-3 sm:pt-4 border-t border-zinc-200 dark:border-zinc-800 flex-1 min-h-0 transition-all duration-300"
          in:fade={{ duration: 300, delay: 200 }}>
          <p class="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 shrink-0">7-day forecast</p>
          <div class="grid grid-cols-7 gap-1 sm:gap-2 flex-1 min-w-0">
            {#each weatherData.forecast.slice(0, 7) as day}
              <div
                class="flex flex-col items-center justify-center min-w-0 w-full px-1 sm:px-2 py-1.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/50 transition-all duration-200">
                <span class="text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 truncate w-full text-center">
                  {formatForecastDate(day.date)}
                </span>
                <span class="text-base sm:text-lg mt-0.5 shrink-0">{getWeatherIcon(day.weathercode)}</span>
                <span class="text-[10px] sm:text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate w-full text-center">
                  {convertTemperature(day.tempMax)}°
                </span>
                <span class="text-[10px] text-zinc-500 dark:text-zinc-500 truncate w-full text-center">
                  {convertTemperature(day.tempMin)}°
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div
      class="flex flex-col items-center justify-center flex-1 py-6 sm:py-8 min-h-0"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">No weather data available</p>
    </div>
  {/if}
</div>
