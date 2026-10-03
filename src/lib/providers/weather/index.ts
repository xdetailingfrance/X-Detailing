/**
 * Abstraction météo (§9, §32).
 *
 * Open-Meteo est gratuit et sans clé : cohérent avec la règle du projet — le système
 * fonctionne sans aucun compte tiers. Le fournisseur ne rend que des mesures ; la
 * décision « cette prestation est-elle faisable » appartient au métier (`server/weather.ts`).
 */

export type HourlyWeather = {
  at: Date;
  precipitationMm: number;
  temperatureC: number;
  windKph: number;
  /** Code WMO tel que renvoyé par le fournisseur. */
  conditionCode: string | null;
};

export interface WeatherProvider {
  readonly name: string;
  /** Prévisions horaires couvrant `from` → `to` pour un point donné. */
  forecast(point: { lat: number; lng: number }, from: Date, to: Date): Promise<HourlyWeather[]>;
}

class OpenMeteoProvider implements WeatherProvider {
  readonly name = "open-meteo";

  async forecast(
    point: { lat: number; lng: number },
    from: Date,
    to: Date,
  ): Promise<HourlyWeather[]> {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", point.lat.toFixed(4));
    url.searchParams.set("longitude", point.lng.toFixed(4));
    url.searchParams.set("hourly", "precipitation,temperature_2m,wind_speed_10m,weather_code");
    url.searchParams.set("timezone", "Europe/Paris");
    url.searchParams.set("start_date", from.toISOString().slice(0, 10));
    url.searchParams.set("end_date", to.toISOString().slice(0, 10));

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Open-Meteo : ${response.status}`);

    const data = (await response.json()) as {
      hourly?: {
        time: string[];
        precipitation: number[];
        temperature_2m: number[];
        wind_speed_10m: number[];
        weather_code: number[];
      };
    };

    if (!data.hourly) return [];

    return data.hourly.time.map((time, index) => ({
      // L'API renvoie une heure locale sans fuseau ; `timezone=Europe/Paris` garantit
      // qu'elle correspond à l'heure du rendez-vous.
      at: new Date(time),
      precipitationMm: data.hourly!.precipitation[index] ?? 0,
      temperatureC: data.hourly!.temperature_2m[index] ?? 0,
      windKph: data.hourly!.wind_speed_10m[index] ?? 0,
      conditionCode: String(data.hourly!.weather_code[index] ?? ""),
    }));
  }
}

class NullWeatherProvider implements WeatherProvider {
  readonly name = "none";
  async forecast(): Promise<HourlyWeather[]> {
    return [];
  }
}

let cached: WeatherProvider | null = null;

export function weatherProvider(): WeatherProvider {
  if (!cached) {
    cached =
      (process.env.WEATHER_PROVIDER ?? "open-meteo") === "none"
        ? new NullWeatherProvider()
        : new OpenMeteoProvider();
  }
  return cached;
}
