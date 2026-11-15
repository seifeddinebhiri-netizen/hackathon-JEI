import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Candidate } from './api';

export default function ScoutingMap({
  candidates,
  center,
  selectedId,
  onSelect,
}: {
  candidates: Candidate[];
  center: [number, number];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());
  const initialCenter = useRef(center);
  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current, { scrollWheelZoom: false }).setView(initialCenter.current, 12);
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance);
    const resize =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => instance.invalidateSize()) : null;
    resize?.observe(element.current);
    return () => {
      resize?.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const currentMarkers = markers.current;
    for (const marker of currentMarkers.values()) marker.remove();
    currentMarkers.clear();
    for (const place of candidates) {
      const label = document.createElement('span');
      label.textContent = place.name;
      const marker = L.circleMarker([place.lat, place.lon], {
        radius: 10,
        color: '#C8102E',
        fillOpacity: 0.8,
      })
        .addTo(instance)
        .bindTooltip(label)
        .on('click', () => onSelect(place.id));
      currentMarkers.set(place.id, marker);
    }
    if (candidates.length)
      instance.fitBounds(L.latLngBounds(candidates.map((p) => [p.lat, p.lon])), {
        padding: [35, 35],
        maxZoom: 15,
      });
    else instance.setView(center, 12);
  }, [candidates, center, onSelect]);
  useEffect(() => {
    for (const [id, marker] of markers.current)
      marker.setStyle({
        color: id === selectedId ? '#121110' : '#C8102E',
        fillColor: id === selectedId ? '#FFC82E' : '#C8102E',
      });
  }, [selectedId, candidates, center]);
  return (
    <div
      ref={element}
      className="relative z-0 h-80 w-full border-2 border-ink md:h-[460px]"
      role="region"
      aria-label="Carte des lieux candidats. Les mêmes lieux sont sélectionnables dans la liste."
    />
  );
}
