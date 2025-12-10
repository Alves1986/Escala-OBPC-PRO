import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudLightning, CloudSnow, MapPin, Loader2 } from 'lucide-react';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  city: string;
}

export const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

    const fetchWeather = async (latitude: number, longitude: number) => {
        try {
            // 1. Buscar Clima (Open-Meteo - API Gratuita e Confiável)
            const weatherRes = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
            );
            
            if (!weatherRes.ok) throw new Error("Falha na API de Clima");
            
            const weatherData = await weatherRes.json();

            // 2. Buscar Nome da Cidade (Nominatim - Fail safe)
            // Envolvemos em um try/catch interno para que se falhar (CORS/Rate Limit), o widget ainda mostre a temperatura
            let city = "Localização Atual";
            try {
              const cityRes = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=pt`
              );
              
              if (cityRes.ok) {
                  const cityData = await cityRes.json();
                  city = cityData.address?.city || cityData.address?.town || cityData.address?.village || cityData.address?.municipality || "Localização Atual";
                  
                  // Limpeza do nome da cidade
                  city = city.replace("Município de ", "").trim();
              }
            } catch (cityErr) {
              console.warn("Não foi possível obter o nome da cidade (usando padrão).");
            }

            setWeather({
              temperature: weatherData.current_weather.temperature,
              weatherCode: weatherData.current_weather.weathercode,
              city: city
            });
            setError(false);

        } catch (e) {
            console.error("Erro ao carregar widget de clima:", e);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeather(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        console.warn("Permissão de localização negada ou indisponível.", err);
        setLoading(false);
      },
      { timeout: 10000, maximumAge: 300000 } // Timeout de 10s, Cache de 5min
    );
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-pulse">
        <Loader2 size={16} className="animate-spin text-zinc-400" />
        <span className="text-xs text-zinc-400">...</span>
      </div>
    );
  }

  if (error || !weather) {
    return null; // Falha silenciosa para não poluir a UI
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow cursor-default group">
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

      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide truncate max-w-[180px]">
           <MapPin size={12} className="text-red-500 shrink-0" /> <span className="truncate">{weather.city}</span>
        </div>
        <span className="text-[10px] text-zinc-400">Tempo Real</span>
      </div>
    </div>
  );
};
