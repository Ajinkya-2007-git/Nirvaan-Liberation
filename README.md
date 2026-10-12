# Nirvaan — Help finds you

An AI-powered disaster response coordination platform that connects people in need with nearby volunteers, NGOs, and rescue teams — in real time, and even when there's no internet connection.

**Live app:** https://nirvaan-liberation.vercel.app/

---

## The problem

During floods and other disasters, the people who need help most are often the ones least able to navigate a complicated app, and the volunteers/NGOs trying to reach them have no coordinated way to know who's already been helped. Nirvaan is built around one core loop: report fast, triage automatically, respond without duplication.

## Core features

### For someone who needs help
- **Quick SOS** — a single tap shares your exact location with nearby responders. No form, no typing, no account needed.
- **Detailed Request Help form** — for when there's time to give more information: name, contact, a map pin for the exact location, a nearby landmark, and a description of the situation.
- **Works with zero signal** — built as an installable Progressive Web App. A submission made completely offline is saved on the device and sent automatically the moment connectivity returns, with nothing lost and nothing to resubmit manually.

### AI-powered triage
- Every detailed request is read by an AI model (served via Groq for fast, free-tier inference) the moment it's submitted, and automatically classified by **category** (medical / food / shelter / rescue) and **urgency** (critical / high / medium / low).
- Offline submissions are classified retroactively the instant they sync back online — nothing skips triage just because it was submitted without a connection.
- If classification ever fails for any reason, the request still saves immediately and simply shows as "unclassified" until a human reviews it — an AI hiccup never blocks someone from getting help.

### Live coordination map
- Every request appears as a color-coded pin — the exact same color scheme is used everywhere in the app, from the map legend to individual request cards, so color always means one consistent thing.
- Volunteers and approved NGOs appear as their own distinct pin types.
- An urgency filter lets anyone — a requester, a volunteer, an NGO, or an admin — isolate the map to just the severity level they care about.
- All updates are real-time via Supabase subscriptions — no refreshing required.

### Volunteers & NGOs
- Individual or group volunteer signup, with selectable skills (medical, general, boat, rescue) and live location.
- NGO signup goes through a genuine verification workflow: an application starts as *pending*, and only an admin can approve or reject it — enforced at the database level, not just hidden by the UI.
- Both get a personal "Your assignments" panel showing exactly what's been assigned to them, with full details, tap-to-call contact info, and one-tap directions.
- Assignment status moves through a real lifecycle: **pending → assigned → en route → resolved**, updated by the responder themselves.

### Admin panel
- The only place in the app where a responder can actually be assigned to a request — a random volunteer or the person requesting help can never self-assign.
- **Area allocation** — an admin can give one NGO exclusive responsibility for a radius around a chosen point on the map, optionally focused on a specific category and/or urgency level, so multiple nearby requests point to one accountable organization instead of several teams converging on the same street.

### Accessibility & reach
- Full multi-language support (English, Hindi, Gujarati) via `react-i18next`, prioritizing the emergency-facing Request Help form.
- Light and dark theme, defaulting to light.
- A sidebar of verified, current Indian government emergency helpline numbers directly on the landing page.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript, Vite, Tailwind CSS v4 |
| Backend | Supabase (Postgres, Auth, Realtime, Row Level Security, Edge Functions) |
| Maps | Leaflet + OpenStreetMap |
| AI classification | Groq (Llama) via a Supabase Edge Function |
| Offline support | `vite-plugin-pwa` (Workbox) + IndexedDB (`idb`) for the offline submission queue |
| Internationalization | `react-i18next` |

## Security notes worth knowing

- Every table uses Row Level Security — permissions are enforced by the database itself, not just by which buttons the frontend happens to show.
- An NGO cannot approve itself; that column is protected by a database trigger, independent of the app's UI.
- No API key or secret lives in the codebase — the AI classification key is stored exclusively as a Supabase Edge Function secret.
- The admin panel is gated by an actual role check that runs before any of its content renders.

## Local development

```bash
npm install
npm run dev
```

Requires a `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`). Database schema and all migrations live in `/supabase`.

## What's next

- True peer-to-peer relay (Bluetooth/WiFi Direct mesh) for total-blackout zones where even the reporting device has no signal to sync through.
- An analytics/impact dashboard summarizing requests handled and average response time.
