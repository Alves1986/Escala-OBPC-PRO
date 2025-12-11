import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudLightning, CloudSnow, MapPin, Loader2, RefreshCw } from 'lucide-react';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  city: string;
  timestamp: number;
}

const CACHE_KEY = 'widget_weather_data';
const CACHE_EXPIRATION = 1000 * 60 * 60; // 1 Hora

export const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getWeatherIcon = (code: number) => {
    // WMO Weather interpretation codes (WW)
    if (code === 0) return <Sun className="text-orange-500" size={24} />;
    if (code >= 1 && code <= 3) return <Cloud className="text-zinc-400" size={24} />;
    if (code >= 51 && code <= 67) return <CloudRain className="text-blue-400" size={24} />;
    if (code >= 71 && code <= 77) return <CloudSnow className="text-cyan-200" size={24} />;
    if (code >= 80 && code <= 82) return <CloudRain className="text-blue-500" size={24} />;
    if (code >= 95) return <CloudLightning className="text-purple-500" size={24} />;
    return <Sun className="text-orange-500" size={24} />;
  };

  const getWeatherDescription = (code: number) => {
    if (code === 0) return "Céu Limpo";
    if (code >= 1 && code <= 3) return "Nublado";
    if (code >= 51 && code <= 67) return "Chuva";
    if (code >= 71 && code <= 77) return "Neve";
    if (code >= 95) return "Tempestade";
    return "Ensolarado";
  };

  const fetchWeatherData = async (lat: number, lon: number) => {
      try {
          // Executa em paralelo para ser mais rápido
          const [weatherRes, cityRes] = await Promise.all([
             fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`),
             fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=pt`)
          ]);

          if (!weatherRes.ok) throw new Error("Weather API Error");
          const weatherJson = await weatherRes.json();
          
          let city = "Localização";
          if (cityRes.ok) {
              const cityJson = await cityRes.json();
              // Tenta pegar o nome mais relevante
              city = cityJson.address?.city || cityJson.address?.town || cityJson.address?.municipality || cityJson.address?.village || "Local";
              city = city.replace("Município de ", "").trim();
          }

          const newData: WeatherData = {
              temperature: weatherJson.current_weather.temperature,
              weatherCode: weatherJson.current_weather.weathercode,
              city,
              timestamp: Date.now()
          };

          setWeather(newData);
          localStorage.setItem(CACHE_KEY, JSON.stringify(newData));

      } catch (e) {
          console.error("Erro ao atualizar clima:", e);
      } finally {
          setLoading(false);
          setRefreshing(false);
      }
  };

  useEffect(() => {
      // 1. Tenta carregar do Cache imediatamente
      const cached = localStorage.getItem(CACHE_KEY);
      let hasValidCache = false;

      if (cached) {
          try {
              const parsed: WeatherData = JSON.parse(cached);
              setWeather(parsed);
              setLoading(false); // Remove loading imediatamente
              
              // Verifica se o cache é recente (menos de 1 hora)
              if (Date.now() - parsed.timestamp < CACHE_EXPIRATION) {
                  hasValidCache = true;
              } else {
                  setRefreshing(true); // Indica que está atualizando em background
              }
          } catch (e) {
              localStorage.removeItem(CACHE_KEY);
          }
      }

      // 2. Se não tem cache válido, ou se o cache expirou, busca novos dados
      if (!hasValidCache || !weather) {
          if (!navigator.geolocation) {
              setLoading(false);
              return;
          }

          navigator.geolocation.getCurrentPosition(
              (pos) => {
                  fetchWeatherData(pos.coords.latitude, pos.coords.longitude);
              },
              (err) => {
                  console.warn("Erro de geolocalização:", err);
                  setLoading(false);
                  setRefreshing(false);
              },
              { 
                  enableHighAccuracy: false, // Mais rápido, menos preciso (suficiente para clima)
                  timeout: 5000, 
                  maximumAge: 1000 * 60 * 30 // Aceita posição cacheada de até 30 min atrás
              }
          );
      }
  }, []);

  if (loading && !weather) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-pulse">
        <Loader2 size={16} className="animate-spin text-zinc-400" />
        <span className="text-xs text-zinc-400">Carregando tempo...</span>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="flex items-center gap-4 px-5 py-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow cursor-default group relative overflow-hidden">
      
      {/* Indicador de Atualização Sutil */}
      {refreshing && (
          <div className="absolute top-0 right-0 p-1">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
          </div>
      )}

      <div className="flex flex-col items-end">
        <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-100 font-bold text-lg leading-none">
          {Math.round(weather.temperature)}°C
          <div className="group-hover:scale-110 transition-transform duration-300">
             {getWeatherIcon(weather.weatherCode)}
          </div>
        </div>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">{getWeatherDescription(weather.weatherCode)}</span>
      </div>
      
      <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

      <div className="flex flex-col justify-center min-w-[80px]">
        <div className="flex items-center gap-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide truncate max-w-[150px]" title={weather.city}>
           <MapPin size={12} className="text-red-500 shrink-0" /> <span className="truncate">{weather.city}</span>
        </div>
        <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-400">Tempo Real</span>
            {refreshing && <RefreshCw size={8} className="animate-spin text-zinc-400"/>}
        </div>
      </div>
    </div>
  );
};