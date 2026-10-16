// The small "shared view of help" map on the landing page. Real requests, volunteers and
// NGOs are shown only to admins, volunteers and approved NGOs; everyone else sees a fixed
// sample so the page still shows what the map looks like. The map starts on the visitor's own
// area only if they've already allowed location, or after they tap "Use my location".
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { Map as MapIcon, ArrowUpRight, ArrowRight, LocateFixed } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { requestIcon, volunteerIcon, ngoIcon } from '../lib/mapIcons';
import { useRole } from '../hooks/useRole';
import { usePlaceName } from '../hooks/usePlaceName';
import type { Urgency } from '../lib/types';

interface Pin {
  id: string;
  lat: number;
  lng: number;
  urgency?: Urgency | null;
}

// Fixed sample pins around Gujarat, shown to visitors who can't see live data.
const SAMPLE_REQUESTS: Pin[] = [
  { id: 'r1', lat: 23.0225, lng: 72.5714, urgency: 'critical' },
  { id: 'r2', lat: 22.3072, lng: 73.1812, urgency: 'high' },
  { id: 'r3', lat: 21.1702, lng: 72.8311, urgency: 'medium' },
  { id: 'r4', lat: 22.5645, lng: 72.9289, urgency: 'low' },
];
const SAMPLE_VOLUNTEERS: Pin[] = [
  { id: 'v1', lat: 23.2156, lng: 72.6369 },
  { id: 'v2', lat: 22.2587, lng: 71.1924 },
];
const SAMPLE_NGOS: Pin[] = [
  { id: 'n1', lat: 21.7645, lng: 72.1519 },
  { id: 'n2', lat: 21.5222, lng: 70.4579 },
];

export function MapPreview() {
  const { t } = useTranslation();
  const { canSeeData } = useRole();
  const [requests, setRequests] = useState<Pin[]>([]);
  const [volunteers, setVolunteers] = useState<Pin[]>([]);
  const [ngos, setNgos] = useState<Pin[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const place = usePlaceName(coords?.lat, coords?.lng);

  // Real data, only for people allowed to see it.
  useEffect(() => {
    if (!canSeeData) return;
    async function load() {
      const [r, v, n] = await Promise.all([
        supabase.from('sos_requests').select('id,latitude,longitude,urgency'),
        supabase.from('volunteer_profiles').select('id,latitude,longitude').eq('available', true),
        supabase.from('ngos').select('id,latitude,longitude').eq('status', 'approved'),
      ]);
      setRequests((r.data ?? []).map((x) => ({ id: x.id, lat: x.latitude, lng: x.longitude, urgency: x.urgency })));
      setVolunteers((v.data ?? []).filter((x) => x.latitude != null).map((x) => ({ id: x.id, lat: x.latitude, lng: x.longitude })));
      setNgos((n.data ?? []).filter((x) => x.latitude != null).map((x) => ({ id: x.id, lat: x.latitude, lng: x.longitude })));
    }
    load();
  }, [canSeeData]);

  function locate() {
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 8000, maximumAge: 60000 }
    );
  }

  // Use the visitor's area automatically ONLY if they already granted permission before.
  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((res) => {
        if (res.state === 'granted') locate();
      })
      .catch(() => {});
  }, []);

  const shownRequests = canSeeData ? requests : SAMPLE_REQUESTS;
  const shownVolunteers = canSeeData ? volunteers : SAMPLE_VOLUNTEERS;
  const shownNgos = canSeeData ? ngos : SAMPLE_NGOS;

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-panel shadow-sm">
      <div className="flex items-start justify-between gap-3 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-paper">
            <span className="hidden sm:inline">{t('home.previewTitleDesktop')}</span>
            <span className="sm:hidden">{t('home.previewTitle')}</span>
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {place ?? 'Gujarat'} · {canSeeData ? t('home.previewLive') : t('home.previewSample')}
          </p>
        </div>
        <MapIcon size={20} className="shrink-0 text-signal" />
      </div>

      <div className="relative isolate h-56 sm:h-64">
        <MapContainer
          key={coords ? 'me' : 'default'}
          center={coords ? [coords.lat, coords.lng] : [22.4, 72.0]}
          zoom={coords ? 10 : 7}
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          keyboard={false}
          boxZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {shownRequests.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={requestIcon(p.urgency)} interactive={false} />
          ))}
          {shownVolunteers.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={volunteerIcon()} interactive={false} />
          ))}
          {shownNgos.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={ngoIcon()} interactive={false} />
          ))}
        </MapContainer>

        {/* Tapping the preview opens the full Live Map. */}
        <Link to="/map" aria-label={t('home.openMap')} className="absolute inset-0 z-[500]" />

        {!coords && (
          <button
            onClick={locate}
            className="absolute right-2 top-2 z-[600] flex min-h-9 items-center gap-1.5 rounded-lg border border-hairline bg-panel px-3 text-xs font-medium text-signal shadow"
          >
            <LocateFixed size={14} />
            {t('home.useMyLocation')}
          </button>
        )}
      </div>

      {/* Desktop footer: legend + link. Phone footer: one big tappable row. */}
      <div className="hidden items-center justify-between px-5 py-4 text-sm sm:flex">
        <div className="flex items-center gap-4 text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#dc2626' }} />{t('home.legendRequests')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#2563eb' }} />{t('home.legendVolunteers')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#16a34a' }} />{t('home.legendNgos')}</span>
        </div>
        <Link to="/map" className="flex items-center gap-1 font-semibold text-signal hover:underline">
          {t('home.openMap')}
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <Link to="/map" className="flex items-center justify-between px-5 py-4 font-semibold text-signal sm:hidden">
        {t('home.explore')}
        <ArrowRight size={18} />
      </Link>
    </div>
  );
}
