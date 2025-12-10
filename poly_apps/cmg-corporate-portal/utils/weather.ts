/**
 * Weather and Time Utilities
 */

export interface WeatherInfo {
  temperature: number;
  condition: string;
  conditionKey: string; // i18n key
  icon: string; // weather icon name
}

export interface TimeInfo {
  time: string;
  date: string;
  timezone: string;
  timezoneName: string;
}

// Mock weather data
export function getMockWeather(location?: string): WeatherInfo {
  const conditions = [
    { condition: 'Sunny', conditionKey: 'weather.sunny', icon: 'sun' },
    { condition: 'Cloudy', conditionKey: 'weather.cloudy', icon: 'cloud' },
    { condition: 'Partly Cloudy', conditionKey: 'weather.partlyCloudy', icon: 'cloud-sun' },
    { condition: 'Rainy', conditionKey: 'weather.rainy', icon: 'cloud-rain' },
  ];
  
  const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
  const temperature = 25 + Math.floor(Math.random() * 10); // 25-35°C
  
  return {
    temperature,
    condition: randomCondition.condition,
    conditionKey: randomCondition.conditionKey,
    icon: randomCondition.icon,
  };
}

export function getTimeInfo(timezone?: string): TimeInfo {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  
  const time = now.toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  
  const date = now.toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  // Get timezone name
  const timezoneName = tz.split('/').pop() || tz;
  
  return {
    time,
    date,
    timezone: tz,
    timezoneName,
  };
}

