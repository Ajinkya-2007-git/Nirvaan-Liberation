// Impact dashboard: turns the data the app already collects into a few honest headline
// numbers (how many requests, how many resolved, how fast help was assigned) plus simple
// breakdowns. Read-only, nothing new is stored. Admin-only, like the other admin tools.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from '../components/Header';

interface RequestRow {
  id: string;
  status: string;
  urgency: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

interface AssignmentRow {
  sos_request_id: string;
  assigned_at: string;
}

// Same colours as the map pins, so "red" means the same thing on every screen.
const URGENCY_ROWS = [
  { key: 'critical', label: 'Critical', color: '#dc2626' },
  { key: 'high', label: 'High', color: '#ea580c' },
  { key: 'medium', label: 'Medium', color: '#eab308' },
  { key: 'low', label: 'Low', color: '#fef08a' },
  { key: 'unclassified', label: 'Unclassified', color: '#111827' },
];

const CATEGORY_ROWS = [
  { key: 'medical', label: 'Medical' },
  { key: 'food', label: 'Food' },
  { key: 'shelter', label: 'Shelter' },
  { key: 'rescue', label: 'Rescue' },
  { key: 'unclassified', label: 'Unclassified' },
];

// Turns milliseconds into a short human phrase like "12 min" or "3 h 5 min".
function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days} d ${remHours} h` : `${days} d`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Median is shown next to the average because one very slow request can drag an average up
// a lot; the median says what a "typical" request experienced.
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-panel p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-paper">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const widthPercent = max > 0 ? Math.max((count / max) * 100, count > 0 ? 3 : 0) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-muted">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink">
        <div className="h-full rounded-full" style={{ width: `${widthPercent}%`, backgroundColor: color }} />
      </div>
      <span className="w-8 shrink-0 text-right font-data text-xs text-paper">{count}</span>
    </div>
  );
}

export function AdminImpact() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<'checking' | true | false>('checking');
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [volunteerCount, setVolunteerCount] = useState(0);
  const [ngoCount, setNgoCount] = useState(0);
  const [areaCount, setAreaCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Same admin gate as the other admin pages.
  useEffect(() => {
    async function checkAdmin() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setAuthorized(false);
        navigate('/');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single();
      if (profile?.role === 'admin') {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        navigate('/');
      }
    }
    checkAdmin();
  }, [navigate]);

  // Only the columns the maths needs. Note: Supabase returns at most 1000 rows per query by
  // default, which is plenty for this app's scale but worth knowing if usage grows a lot.
  const load = useCallback(async () => {
    const [req, asg, vol, ngo, area] = await Promise.all([
      supabase.from('sos_requests').select('id,status,urgency,category,created_at,updated_at'),
      supabase.from('assignments').select('sos_request_id,assigned_at'),
      supabase.from('volunteer_profiles').select('id', { count: 'exact', head: true }).eq('available', true),
      supabase.from('ngos').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('ngo_area_assignments').select('id', { count: 'exact', head: true }).neq('status', 'reassigned'),
    ]);
    if (req.data) setRequests(req.data);
    if (asg.data) setAssignments(asg.data);
    setVolunteerCount(vol.count ?? 0);
    setNgoCount(ngo.count ?? 0);
    setAreaCount(area.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authorized !== true) return;
    load();
    // Re-calculate whenever any request changes, so the numbers stay live.
    const channel = supabase
      .channel('admin-impact')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_requests' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authorized, load]);

  const stats = useMemo(() => {
    const total = requests.length;
    const resolved = requests.filter((r) => r.status === 'resolved').length;
    const pending = requests.filter((r) => r.status === 'pending').length;
    const inProgress = requests.filter((r) => r.status === 'assigned' || r.status === 'en_route').length;

    // Earliest assignment per request: a request can in theory be assigned more than once, but
    // "time to assign" should measure how long until the FIRST responder was lined up.
    const firstAssigned = new Map<string, number>();
    for (const a of assignments) {
      const t = new Date(a.assigned_at).getTime();
      const existing = firstAssigned.get(a.sos_request_id);
      if (existing === undefined || t < existing) firstAssigned.set(a.sos_request_id, t);
    }

    const timesToAssign: number[] = [];
    const timesToResolve: number[] = [];
    for (const r of requests) {
      const created = new Date(r.created_at).getTime();
      const assignedAt = firstAssigned.get(r.id);
      if (assignedAt !== undefined && assignedAt >= created) timesToAssign.push(assignedAt - created);
      // updated_at is last touched when a request is marked resolved, so for resolved requests it
      // approximates the resolution time (an approximation, not a dedicated timestamp).
      if (r.status === 'resolved') {
        const resolvedAt = new Date(r.updated_at).getTime();
        if (resolvedAt >= created) timesToResolve.push(resolvedAt - created);
      }
    }

    const urgencyCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    for (const r of requests) {
      const u = r.urgency ?? 'unclassified';
      const c = r.category ?? 'unclassified';
      urgencyCounts[u] = (urgencyCounts[u] ?? 0) + 1;
      categoryCounts[c] = (categoryCounts[c] ?? 0) + 1;
    }

    // Requests per day for the last 7 days (oldest first).
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const key = day.toDateString();
      days.push({
        label: day.toLocaleDateString(undefined, { weekday: 'short' }),
        count: requests.filter((r) => new Date(r.created_at).toDateString() === key).length,
      });
    }

    return {
      total,
      resolved,
      pending,
      inProgress,
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
      respondedRate: total > 0 ? Math.round(((total - pending) / total) * 100) : 0,
      avgAssign: average(timesToAssign),
      medianAssign: median(timesToAssign),
      avgResolve: average(timesToResolve),
      medianResolve: median(timesToResolve),
      urgencyCounts,
      categoryCounts,
      days,
    };
  }, [requests, assignments]);

  if (authorized !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <p className="text-muted">Checking access...</p>
      </div>
    );
  }

  const urgencyMax = Math.max(0, ...Object.values(stats.urgencyCounts));
  const categoryMax = Math.max(0, ...Object.values(stats.categoryCounts));
  const dayMax = Math.max(0, ...stats.days.map((d) => d.count));

  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold text-paper">Impact</h1>
          <div className="flex gap-4 text-sm">
            <Link to="/admin" className="text-signal hover:underline">
              ← Live map
            </Link>
            <Link to="/admin/requests" className="text-signal hover:underline">
              Requests list →
            </Link>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">What the platform has actually done, calculated live from real requests.</p>

        {loading ? (
          <p className="mt-8 text-muted">Loading...</p>
        ) : stats.total === 0 ? (
          <p className="mt-8 text-muted">No requests yet — numbers will appear here as soon as the first one comes in.</p>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Requests received"
                value={String(stats.total)}
                hint={`${stats.pending} waiting · ${stats.inProgress} in progress`}
              />
              <StatCard
                label="Resolved"
                value={`${stats.resolutionRate}%`}
                hint={`${stats.resolved} of ${stats.total} requests`}
              />
              <StatCard
                label="Responded to"
                value={`${stats.respondedRate}%`}
                hint="Requests that got a responder assigned"
              />
              <StatCard
                label="Avg time to assign"
                value={formatDuration(stats.avgAssign)}
                hint={`Typical (median): ${formatDuration(stats.medianAssign)}`}
              />
              <StatCard
                label="Avg time to resolve"
                value={formatDuration(stats.avgResolve)}
                hint={`Typical (median): ${formatDuration(stats.medianResolve)} · approximate`}
              />
              <StatCard
                label="Responders"
                value={String(volunteerCount + ngoCount)}
                hint={`${volunteerCount} volunteers available · ${ngoCount} NGOs · ${areaCount} areas allocated`}
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-hairline bg-panel p-5">
                <h2 className="font-display text-sm font-semibold text-paper">By urgency</h2>
                <div className="mt-4 flex flex-col gap-3">
                  {URGENCY_ROWS.map((row) => (
                    <BarRow
                      key={row.key}
                      label={row.label}
                      count={stats.urgencyCounts[row.key] ?? 0}
                      max={urgencyMax}
                      color={row.color}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-hairline bg-panel p-5">
                <h2 className="font-display text-sm font-semibold text-paper">By type of help</h2>
                <div className="mt-4 flex flex-col gap-3">
                  {CATEGORY_ROWS.map((row) => (
                    <BarRow
                      key={row.key}
                      label={row.label}
                      count={stats.categoryCounts[row.key] ?? 0}
                      max={categoryMax}
                      color="#2fb0ac"
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-hairline bg-panel p-5">
              <h2 className="font-display text-sm font-semibold text-paper">Requests in the last 7 days</h2>
              <div className="mt-4 flex h-32 items-end gap-2">
                {stats.days.map((d, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <span className="font-data text-[10px] text-muted">{d.count}</span>
                    <div
                      className="w-full rounded-t-md bg-signal"
                      style={{ height: `${dayMax > 0 ? Math.max((d.count / dayMax) * 80, d.count > 0 ? 4 : 0) : 0}px` }}
                    />
                    <span className="text-[10px] text-muted">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
