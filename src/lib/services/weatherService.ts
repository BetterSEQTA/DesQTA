import { invoke } from '@tauri-apps/api/core';
import { cache } from '../../utils/cache';
import { logger } from '../../utils/logger';

export interface ForecastDay {
  date: string;
  tempMax: number;
  tempMin: number;
  weathercode: number;
}

function parseDailyForecast(json: {
  daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; weathercode?: number[] };
}): ForecastDay[] {
  const daily = json.daily;
  if (!daily?.time?.length) return [];

  const result: ForecastDay[] = [];
  const maxes = daily.temperature_2m_max || [];
  const mins = daily.temperature_2m_min || [];
  const codes = daily.weathercode || [];

  for (let i = 0; i < daily.time.length; i++) {
    result.push({
      date: daily.time[i],
      tempMax: maxes[i] ?? 0,
      tempMin: mins[i] ?? 0,
      weathercode: codes[i] ?? 0,
    });
  }
  return result;
}

export interface WeatherData {
  temperature: number;
  weathercode: number;
  location: string;
  country: string;
  forecast?: ForecastDay[];
}

export interface WeatherSettings {
  weather_enabled: boolean;
  force_use_location: boolean;
  weather_city: string;
  weather_country?: string;
}

/** Default fallback when city/country are empty (e.g. force fallback location with no input). */
export const DEFAULT_WEATHER_CITY = 'Adelaide';
export const DEFAULT_WEATHER_COUNTRY = 'AU';

export function resolveWeatherLocation(city: string, country?: string): {
  city: string;
  country: string;
} {
  const trimmedCity = city.trim();
  const trimmedCountry = (country ?? '').trim();
  return {
    city: trimmedCity || DEFAULT_WEATHER_CITY,
    country: trimmedCountry || DEFAULT_WEATHER_COUNTRY,
  };
}

export const weatherService = {
  async loadWeatherSettings(): Promise<WeatherSettings> {
    logger.debug('weatherService', 'loadWeatherSettings', 'Loading weather settings');
    
    try {
      const settings = await invoke<any>('get_settings_subset', { keys: ['weather_enabled','weather_city','weather_country','force_use_location'] });
      logger.debug('weatherService', 'loadWeatherSettings', 'Weather settings loaded successfully', { 
        enabled: settings?.weather_enabled 
      });
      const resolved = resolveWeatherLocation(
        settings?.weather_city ?? '',
        settings?.weather_country ?? '',
      );
      return {
        weather_enabled: settings?.weather_enabled ?? false,
        weather_city: resolved.city,
        weather_country: resolved.country,
        force_use_location: settings?.force_use_location ?? false,
      };
    } catch (e) {
      logger.error('weatherService', 'loadWeatherSettings', `Failed to load weather settings: ${e}`, { error: e });
      const resolved = resolveWeatherLocation('', '');
      return {
        weather_enabled: false,
        weather_city: resolved.city,
        weather_country: resolved.country,
        force_use_location: false,
      };
    }
  },

  async fetchWeatherWithIP(): Promise<WeatherData | null> {
    const cachedWeather = cache.get<WeatherData>('weather');
    if (cachedWeather) {
      return cachedWeather;
    }

    try {
      let latitude: number, longitude: number, name: string, country: string;

      try {
        const ipRes = await fetch('http://ip-api.com/json/');
        const ipJson = await ipRes.json();
        if (ipJson.status !== 'success') throw new Error('IP Geolocation failed');

        latitude = ipJson.lat;
        longitude = ipJson.lon;
        name = ipJson.city;
        country = ipJson.country;
      } catch {
        const fallback = resolveWeatherLocation('', '');
        return this.fetchWeather(fallback.city, fallback.country);
      }

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`,
      );
      const weatherJson = await weatherRes.json();

      const forecast = parseDailyForecast(weatherJson);
      const weatherData: WeatherData = {
        ...weatherJson.current_weather,
        location: name,
        country,
        forecast,
      };

      cache.set('weather', weatherData, 15 * 60 * 1000);
      return weatherData;
    } catch (e) {
      console.error('Failed to load weather with IP:', e);
      return null;
    }
  },

  async fetchWeather(weatherCity: string, weatherCountry: string): Promise<WeatherData | null> {
    const { city, country } = resolveWeatherLocation(weatherCity, weatherCountry);

    const cachedWeather = cache.get<WeatherData>('weather');
    if (cachedWeather) {
      return cachedWeather;
    }

    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&countryCode=${encodeURIComponent(country)}&count=10&language=en&format=json`,
      );
      const geoJson = await geoRes.json();
      if (!geoJson.results || !geoJson.results.length) {
        throw new Error('Location not found');
      }

      const { latitude, longitude, name, country: resolvedCountryName } = geoJson.results[0];
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`,
      );
      const weatherJson = await weatherRes.json();

      const forecast = parseDailyForecast(weatherJson);
      const weatherData: WeatherData = {
        ...weatherJson.current_weather,
        location: name,
        country: resolvedCountryName,
        forecast,
      };

      cache.set('weather', weatherData, 15 * 60 * 1000);
      return weatherData;
    } catch (e) {
      console.error('Failed to load weather:', e);
      return null;
    }
  },
};