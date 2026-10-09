# FoodShare

A mobile-first, community-centred food redistribution PWA prototype built with React + TypeScript, Vite, Tailwind CSS, Framer Motion, Leaflet/OpenStreetMap and an optional Supabase backend.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Vite prints a local URL (usually `http://localhost:5173`). To check the production build:

```bash
npm run build
npm run preview
```

## What works in demo mode

- Landing page with animated hero, responsive layouts, impact stats and calls to action.
- Role switcher for Donor, NGO, Volunteer and Admin experiences.
- Create a donation with food details, dietary tags, quantity, expiry, pickup location, notes and required food-safety confirmation.
- Donation listings with live expiry countdowns, urgency-first ordering, category/search filters, distances and dietary tags.
- Interactive OpenStreetMap using Leaflet; select a marker or a donation to inspect details.
- Claim confirmation; expired donations are rejected; claiming changes status and adds a pickup tracking entry.
- Pickup progression: Reserved → Pickup scheduled → Collected.
- Donation activity list, impact dashboard, notification toasts, responsive mobile quick-donate action and local persistence using `localStorage`.
- Reduced-motion support using `prefers-reduced-motion`.

Demo mode is intentionally usable without credentials and seeds realistic sample donations. It is a front-end demo: localStorage is per browser/device, and the sign-in dialog is a role-based preview, not secure authentication. Do not use it for real food-safety or personal data until backend setup is complete.

## Connect Supabase

1. Create a Supabase project.
2. In the Supabase SQL editor, run `supabase/schema.sql`.
3. Create a private Storage bucket named `food-photos`. Add owner-scoped upload/read policies before uploading real photos.
4. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Configure Supabase Auth providers and email confirmation settings.
6. Add a server-side profile creation flow/trigger and production auth screens before real-world launch.

The SQL schema includes profiles, organisations, donations, claims, pickup tasks, donation event timelines, notifications, food-safety confirmations, impact metrics, reports and moderation actions. It also includes a claim RPC that rechecks expiry and current status atomically.

**Security note:** This starter is not a production-ready deployment. Review and test all RLS policies, verify NGO organisations before allowing claims, implement secure contact-detail reveal rules, rate limiting, audit trails, email/phone verification, image validation, and server-side expiry enforcement. Avoid using public contact details or public storage buckets for sensitive data.

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS configuration and custom responsive design system
- Framer Motion with reduced-motion handling
- Leaflet + OpenStreetMap
- Supabase JS client scaffold
- PWA web manifest
