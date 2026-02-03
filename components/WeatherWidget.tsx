import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudLightning, CloudSnow, MapPin, Loader2, RefreshCw } from 'lucide-react';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  city: string;
  timestamp: number;
}

const CACHE_KEY = 'widget_weather_data_v4';
const CACHE_EXPIRATION = 1000 * 60 * 30; // 30 Minutos

export const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

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

  useEffect(() => {
      let isMounted = true;

      const fetchWeatherData = async (lat: number, lon: number) => {
          try {
              // Executa em paralelo para ser mais rápido
              const [weatherRes, cityRes] = await Promise.all([
                 fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`),
                 fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=pt-BR`)
              ]);

              if (!weatherRes.ok) throw new Error("Weather API Error");
              const weatherJson = await weatherRes.json();
              
              let city = "Localização";
              if (cityRes.ok) {
                  const cityJson = await cityRes.json();
                  const addr = cityJson.address;
                  // Prioriza a cidade/município sobre vila/subúrbio para evitar nomes de bairro
                  city = addr?.city || addr?.municipality || addr?.town || addr?.village || addr?.suburb || "Local";
                  city = city.replace("Município de ", "").replace("Distrito de ", "").trim();
              }

              const newData: WeatherData = {
                  temperature: weatherJson.current_weather.temperature,
                  weatherCode: weatherJson.current_weather.weathercode,
                  city,
                  timestamp: Date.now()
              };

              if (isMounted) {
                  setWeather(newData);
                  localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
                  setError(false);
              }

          } catch (e) {
              console.error("Erro ao atualizar clima:", e);
              if (isMounted) setError(true);
          } finally {
              if (isMounted) {
                  setLoading(false);
                  setRefreshing(false);
              }
          }
      };

      const getLocationAndFetch = () => {
          if (!navigator.geolocation) {
              setLoading(false);
              setError(true);
              return;
          }

          navigator.geolocation.getCurrentPosition(
              (pos) => {
                  fetchWeatherData(pos.coords.latitude, pos.coords.longitude);
              },
              (err) => {
                  console.warn("Erro de geolocalização:", err);
                  if (isMounted) {
                      setLoading(false);
                      setRefreshing(false);
                      setError(true);
                  }
              },
              { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
          );
      };

      // 1. Tenta carregar do Cache
      const cached = localStorage.getItem(CACHE_KEY);
      let hasValidCache = false;

      if (cached) {
          try {
              const parsed: WeatherData = JSON.parse(cached);
              setWeather(parsed);
              setLoading(false); 
              
              // Verifica se o cache é recente
              if (Date.now() - parsed.timestamp < CACHE_EXPIRATION) {
                  hasValidCache = true;
              } else {
                  setRefreshing(true); 
              }
          } catch (e) {
              localStorage.removeItem(CACHE_KEY);
          }
      }

      // 2. Se não tem cache válido, busca novos dados
      if (!hasValidCache || refreshing) {
          getLocationAndFetch();
      }

      return () => { isMounted = false; };
  }, [refreshing]);

  const handleRefresh = (e: React.MouseEvent) => {
      e.stopPropagation();
      setRefreshing(true);
  };

  if (loading && !weather) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-pulse">
        <Loader2 size={16} className="animate-spin text-zinc-400" />
        <span className="text-xs text-zinc-400">Localizando...</span>
      </div>
    );
  }

  if (error && !weather) {
      return (
        <button onClick={handleRefresh} className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800/50 shadow-sm text-red-500 hover:bg-red-100 transition-colors">
            <RefreshCw size={14} />
            <span className="text-xs font-bold">Tentar Novamente</span>
        </button>
      );
  }

  if (!weather) return null;

  return (
    <div className="flex items-center gap-4 px-5 py-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
      
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
        <button 
            onClick={handleRefresh}
            className="flex items-center gap-1 mt-0.5 text-[10px] text-zinc-400 hover:text-blue-500 transition-colors"
            disabled={refreshing}
        >
            <span className="truncate">Atualizar Local</span>
            <RefreshCw size={8} className={refreshing ? "animate-spin text-blue-500" : ""}/>
        </button>
      </div>
    </div>
  );
};