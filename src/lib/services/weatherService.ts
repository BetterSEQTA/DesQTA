import { invoke } from '@tauri-apps/api/core';
import { cache } from '../../utils/cache';
import { logger } from '../../utils/logger';

export interface WeatherData {
  temperature: number;
  weathercode: number;
  location: string;
  country: string;
}

export interface WeatherSettings {
  weather_enabled: boolean;
  force_use_location: boolean;
  weather_city: string;
  weather_country?: string;
}

export const weatherService = {
  async loadWeatherSettings(): Promise<WeatherSettings> {
    logger.debug('weatherService', 'loadWeatherSettings', 'Loading weather settings');
    
    try {
      const settings = await invoke<WeatherSettings>('get_settings');
      logger.debug('weatherService', 'loadWeatherSettings', 'Weather settings loaded successfully', { 
        enabled: settings.weather_enabled 
      });
      return {
        weather_enabled: settings.weather_enabled ?? false,
        weather_city: settings.weather_city ?? '',
        weather_country: settings.weather_country ?? '',
        force_use_location: settings.force_use_location ?? false,
      };
    } catch (e) {
      logger.error('weatherService', 'loadWeatherSettings', `Failed to load weather settings: ${e}`, { error: e });
      return {
        weather_enabled: false,
        weather_city: '',
        weather_country: '',
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
      } catch (geoError) {
        throw new Error('IP geolocation failed and no fallback location provided');
      }

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`,
      );
      const weatherJson = await weatherRes.json();

      const weatherData: WeatherData = {
        ...weatherJson.current_weather,
        location: name,
        country,
      };

      cache.set('weather', weatherData, 15 * 60 * 1000);
      return weatherData;
    } catch (e) {
      console.error('Failed to load weather with IP:', e);
      return null;
    }
  },

  async fetchWeather(weatherCity: string, weatherCountry: string): Promise<WeatherData | null> {
    if (!weatherCity) {
      return null;
    }

    const cachedWeather = cache.get<WeatherData>('weather');
    if (cachedWeather) {
      return cachedWeather;
    }

    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(weatherCity)}&countryCode=${encodeURIComponent(weatherCountry)}&count=10&language=en&format=json`,
      );
      const geoJson = await geoRes.json();
      if (!geoJson.results || !geoJson.results.length) {
        throw new Error('Location not found');
      }

      const { latitude, longitude, name, country } = geoJson.results[0];
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`,
      );
      const weatherJson = await weatherRes.json();

      const weatherData: WeatherData = {
        ...weatherJson.current_weather,
        location: name,
        country,
      };

      cache.set('weather', weatherData, 15 * 60 * 1000);
      return weatherData;
    } catch (e) {
      console.error('Failed to load weather:', e);
      return null;
    }
  },
};