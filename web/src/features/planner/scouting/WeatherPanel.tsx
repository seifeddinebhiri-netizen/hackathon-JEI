import type { Candidate, Weather } from './api';
import { localTime, solarTimes } from './solar';

export function WeatherPanel({ place, weather }: { place: Candidate; weather: Weather }) {
  const sun = solarTimes(weather.date, weather.timezone, place.lat, place.lon);
  return (
    <section
      aria-label={`Météo de ${place.name}`}
      className="flex flex-col gap-3 border-2 border-ink bg-white p-5"
    >
      <h2 className="text-h2">{place.name} · Météo & lumière</h2>
      <p className="text-meta">
        Heures locales : {weather.timezone}. Prévisions Open-Meteo récupérées le{' '}
        {new Date(weather.fetched_at).toLocaleString('fr-FR')}.
      </p>
      {weather.status === 'unavailable' ? (
        <p role="status" className="bg-gold-soft p-3">
          Prévision indisponible : {weather.reason}
        </p>
      ) : (
        <>
          <p>
            Lever : {localTime(weather.sunrise, weather.timezone)} · Coucher :{' '}
            {localTime(weather.sunset, weather.timezone)} (Open-Meteo)
          </p>
          <div className="max-h-72 overflow-auto" tabIndex={0} role="region" aria-label="Prévisions horaires">
            <table className="w-full min-w-[560px] text-left text-meta">
              <caption className="sr-only">Prévisions horaires de {place.name}</caption>
              <thead>
                <tr>
                  {['Heure', 'Temp. °C', 'Vent km/h', 'Précip. mm', 'Nuages %'].map((h) => (
                    <th key={h} scope="col" className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weather.hours.map((h) => (
                  <tr key={h.time} className="border-t border-line-light">
                    <th scope="row" className="p-2">
                      {localTime(h.time, weather.timezone)}
                    </th>
                    {[h.temperature_c, h.wind_kmh, h.precipitation_mm, h.cloud_pct].map((v, i) => (
                      <td key={i} className="p-2">
                        {v ?? 'Indisponible'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-meta">
            Les précipitations sont alignées sur l’heure commençant à cet horodatage. Température et vent sont
            des valeurs extérieures, pas des mesures sur le plateau.
          </p>
        </>
      )}
      <p className="text-meta">
        Calcul SunCalc : lever {localTime(sun.sunrise, weather.timezone)}, coucher{' '}
        {localTime(sun.sunset, weather.timezone)} ; aube {localTime(sun.dawn, weather.timezone)}, crépuscule{' '}
        {localTime(sun.dusk, weather.timezone)}.
      </p>
      <p className="text-meta">
        Lumière dorée calculée : {localTime(sun.sunrise, weather.timezone)}–
        {localTime(sun.goldenMorningEnd, weather.timezone)} et{' '}
        {localTime(sun.goldenEveningStart, weather.timezone)}–{localTime(sun.sunset, weather.timezone)}. Ces
        calculs astronomiques ne sont pas des prévisions météo.
      </p>
    </section>
  );
}
