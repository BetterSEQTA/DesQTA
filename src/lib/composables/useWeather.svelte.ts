import { invoke } from '@tauri-apps/api/core';
import { weatherService, resolveWeatherLocation, type WeatherData } from '$lib/services/weatherService';
import { cache } from '../../utils/cache';
import { logger } from '../../utils/logger';

/** Mock weather data for demo/sensitive-info-hider mode */
const MOCK_WEATHER_DATA: WeatherData = {
  temperature: 22,
  weathercode: 0,
  location: 'Demo City',
  country: 'AU',
  forecast: [
    { date: '2025-12-31', tempMax: 24, tempMin: 18, weathercode: 0 },
    { date: '2026-01-01', tempMax: 23, tempMin: 17, weathercode: 1 },
    { date: '2026-01-02', tempMax: 25, tempMin: 19, weathercode: 2 },
  ],
};

/**
 * Weather composable for managing weather state and fetching.
 * Uses Svelte runes so header/layout react when settings or data change.
 */
export function useWeather() {
  let enabled = $state(false);
  let forceUseLocation = $state(false);
  let city = $state('');
  let country = $state('');
  let data = $state<WeatherData | null>(null);
  let loading = $state(false);
  let error = $state('');

  const loadSettings = async () => {
    const settings = await weatherService.loadWeatherSettings();
    enabled = settings.weather_enabled;
    city = settings.weather_city;
    country = settings.weather_country ?? '';
    forceUseLocation = settings.force_use_location;

    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['dev_sensitive_info_hider'],
      });
      if (subset?.dev_sensitive_info_hider) {
        enabled = true;
        data = MOCK_WEATHER_DATA;
      }
    } catch {
      // Ignore - use normal settings
    }
  };

  const fetchWeather = async (useIP = false) => {
    if (!enabled) {
      data = null;
      return;
    }

    const { city: resolvedCity, country: resolvedCountry } = resolveWeatherLocation(city, country);

    loading = true;
    error = '';
    try {
      cache.delete('weather');

      if (useIP) {
        data = await weatherService.fetchWeatherWithIP();
        if (!data) {
          data = await weatherService.fetchWeather(resolvedCity, resolvedCountry);
        }
      } else {
        data = await weatherService.fetchWeather(resolvedCity, resolvedCountry);
      }

      if (!data) {
        error = 'Failed to load weather';
      }
    } catch (e) {
      error = `Failed to load weather: ${e}`;
      data = null;
      logger.error('weather', 'fetchWeather', `Failed to load weather: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  };

  const refreshFromSettings = async () => {
    await loadSettings();
    if (enabled) {
      await fetchWeather(!forceUseLocation);
    } else {
      data = null;
    }
  };

  return {
    get enabled() {
      return enabled;
    },
    get forceUseLocation() {
      return forceUseLocation;
    },
    get city() {
      return city;
    },
    get country() {
      return country;
    },
    get data() {
      return data;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    loadSettings,
    fetchWeather,
    refreshFromSettings,
  };
}
