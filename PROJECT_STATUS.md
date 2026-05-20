# PeterPark — Stato del progetto

> Documento di handover. Serve a riprendere il lavoro su un altro computer
> (in particolare per la parte SQL/Supabase che non puo' essere fatta su ARM).
>
> **Ultimo aggiornamento:** vedi data dell'ultimo commit sul branch `main`.

---

## 1. Cos'e' PeterPark (in breve)

App mobile + web per **segnalare e trovare parcheggi liberi**, con:

- **Sistema a punti**: bonus iniziale 50 punti, +5 per segnalare, +10 conferma da feedback positivo, +2 per feedback, -10 per prenotare un parcheggio.
- **Feedback** dopo l'arrivo (era libero? rating, commento). Genera bonus al reporter o penalita' se palesemente falso.
- **Anti-frode**: rate limiting, distanza minima tra segnalazioni, reputazione utente, logica server-side.
- **Autenticazione** via email/password (estendibile ad Apple/Google).

---

## 2. Stack tecnologico

- **Frontend**: Expo SDK 54 (React Native + Web) + TypeScript, expo-router (file-based routing).
- **Mappe**: `react-native-maps` + `expo-location`.
- **State**: Zustand (auth globale) + TanStack Query (server cache).
- **Backend**: **Supabase** (PostgreSQL + PostGIS + Auth + Realtime + Storage).
- **Logica di business**: in **RPC PostgreSQL** standard (no Edge Functions Deno → zero lock-in, portabile a qualsiasi Postgres).
- **Astrazione client**: tutte le chiamate Supabase passano per la cartella `api/`, cosi' un domani si cambia backend toccando solo quei file.

---

## 3. Struttura cartelle

```
app/
  _layout.tsx            # Root layout: AuthGate, redirect (auth)<->(tabs)
  (auth)/
    _layout.tsx
    welcome.tsx          # Hero + bottoni "Crea account" / "Ho gia un account"
    login.tsx
    register.tsx
  (tabs)/
    _layout.tsx          # Tab bar: Mappa, Profilo
    index.tsx            # Mappa con marker spot vicini (raggio 1km, refresh 15s)
    profile.tsx          # Punti, statistiche, storico transazioni, logout
  report.tsx             # Modale "Segnala parcheggio" (tipo, durata, note, GPS)

api/                     # LAYER DI ASTRAZIONE — il punto di disaccoppiamento da Supabase
  auth.ts                # signUpWithEmail, signInWithEmail, signOut, getSession, onAuthStateChange
  spots.ts               # searchNearbySpots, reportParkingSpot, claimParkingSpot, submitSpotFeedback
  profile.ts             # getMyProfile, getMyPointsHistory, updateUsername

lib/supabase.ts          # Client Supabase con AsyncStorage + autoRefresh
stores/auth.ts           # Zustand store auth ({ session, hydrated })
components/
  providers.tsx          # QueryClientProvider + auth state listener
  button.tsx
  text-field.tsx
  themed-text.tsx
  themed-view.tsx
  haptic-tab.tsx
  ui/icon-symbol.tsx     # Mapping SF Symbols -> MaterialIcons (per Android/web)
hooks/                   # useColorScheme, useThemeColor
constants/theme.ts       # Palette colori (light/dark) + font
types/database.ts        # Tipi DB (sostituibili con types generati da Supabase CLI)

supabase/
  migrations/
    0001_init.sql        # SCHEMA COMPLETO: tabelle, RPC, RLS, trigger, realtime
```

---

## 4. Cosa e' stato fatto

### Codice mobile/web (FATTO)

- [x] Pulizia template Expo (rimossi `explore.tsx`, `hello-wave.tsx`, `parallax-scroll-view.tsx`, `collapsible.tsx`, `external-link.tsx`, `modal.tsx`, `reset-project.js`)
- [x] Riorganizzazione in `(auth)` e `(tabs)`
- [x] Dipendenze installate: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, `expo-secure-store`, `zustand`, `@tanstack/react-query`, `react-hook-form`, `zod`
- [x] Permessi location aggiunti in `app.json` per iOS (`NSLocationWhenInUseUsageDescription`) e Android (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`)
- [x] Client Supabase configurato (`lib/supabase.ts`) con session storage + autorefresh sospeso quando app va in background
- [x] Layer API (`api/auth.ts`, `api/spots.ts`, `api/profile.ts`)
- [x] AuthGate in root layout (redirect tra (auth) e (tabs))
- [x] Schermate auth: welcome, login, register (validazione base + bonus 50pt comunicato all'utente)
- [x] Mappa con marker dinamici, refresh ogni 15s, callout per prenotare
- [x] Schermata profilo con statistiche + storico transazioni
- [x] Schermata segnalazione (chip per tipo parcheggio, durata, note opzionali)
- [x] UI riusabile (`Button`, `TextField`) tematizzata light/dark

### Schema SQL (DA APPLICARE SU SUPABASE — vedi sezione 6)

Il file `supabase/migrations/0001_init.sql` e' pronto e contiene:

- Estensioni `postgis` e `uuid-ossp`
- Enum: `spot_type`, `spot_status`, `tx_reason`
- Tabelle: `profiles`, `parking_spots`, `feedbacks`, `points_transactions`
- Indice GIST su `parking_spots.location` per query geo veloci
- Trigger:
  - `tg_set_updated_at` su update di profiles/parking_spots
  - `tg_handle_new_user` → crea automaticamente il profilo + bonus 50 punti alla registrazione
- **RPC (logica di business server-side):**
  - `spots_nearby(lat, lng, radius_m, limit)` → ST_DWithin + ordinamento per distanza
  - `create_parking_spot(...)` → con anti-spam (max 5/24h, no duplicati a <50m)
  - `claim_parking_spot(spot_id)` → verifica punti, addebita -10, cambia stato (atomica con FOR UPDATE)
  - `submit_feedback(...)` → +2 al feedbacker, +10 al reporter se positivo, penalita' -20 con 2+ feedback negativi
  - `expire_old_spots()` → da schedulare con pg_cron
- Row Level Security su tutte le tabelle
- Publication `supabase_realtime` su `parking_spots`

---

## 5. Cosa NON e' stato fatto (roadmap)

### Subito (prossimi step ad alto impatto)

- [ ] **Applicare la migration SQL su Supabase** ← BLOCCATO finche' non sei su un computer x86
- [ ] **Test end-to-end** del flusso completo (registrazione → segnalazione → claim → feedback) per verificare che tutte le RPC funzionino
- [ ] **Realtime live**: sottoscrizione `supabase.channel().on('postgres_changes', ...)` nella mappa per vedere comparire nuovi spot senza polling
- [ ] **Foto parcheggio**: Supabase Storage + `expo-image-picker`; il campo `photo_url` e' gia' nel DB

### Medio termine

- [ ] **Geofencing arrivo**: `expo-task-manager` + `Location.startGeofencingAsync` → notifica "Sei arrivato? Era libero?"
- [ ] **Mock location detection**: leggere `loc.mocked` da `expo-location`, penalizzare reputazione
- [ ] **Cluster marker** quando ci sono troppi pin (`react-native-maps-clustering` o `supercluster`)
- [ ] **Push notifications**: `expo-notifications` + Supabase Edge Function (in TS portabile) o servizio esterno (OneSignal)
- [ ] **Apple Sign-In** (obbligatorio per pubblicare su App Store se hai Google login) + **Google Sign-In**
- [ ] **i18n**: italiano/inglese con `expo-localization` + `i18n-js`

### Lungo termine

- [ ] **Heatmap storica** delle zone con piu' parcheggi
- [ ] **Modalita' guida** con UI grande + annunci vocali
- [ ] **Livelli/badge** (Novizio, Esploratore, Park Hero...) + classifiche settimanali
- [ ] **Inviti amici** con codice referral (+30 pt)
- [ ] **Streak giornaliera** (+5 pt/giorno di uso continuativo)
- [ ] **Pagamento sosta in-app** per parcheggi a pagamento (monetizzazione)
- [ ] **Sentry** error tracking + **PostHog/Amplitude** analytics
- [ ] **EAS Build** + **EAS Update** per OTA hotfix

### Aspetti legali/privacy

- [ ] Privacy policy + consenso GDPR esplicito
- [ ] Pagina cancellazione account + export dati
- [ ] Verifica legale: i punti NON devono essere scambiabili in cash (altrimenti rischia di diventare compravendita di parcheggio pubblico)

---

## 6. COME RIPRENDERE IL LAVORO (su computer x86 con SQL)

### 6.1 Clone e dipendenze

```powershell
git clone https://github.com/branz91/Peter_park_new.git
cd Peter_park_new
npm install
```

### 6.2 Crea progetto Supabase

1. Vai su [supabase.com](https://supabase.com) → **New project**
2. Scegli regione **Frankfurt** (latenza migliore per l'Italia)
3. Project Settings → API → copia:
   - **Project URL** (es. `https://xxxxx.supabase.co`)
   - **anon public key** (la chiave lunga `eyJhbGci...`)

### 6.3 Crea `.env.local` (NON committarlo, e' gia' nel `.gitignore`)

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 6.4 Applica lo schema SQL

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Apri `supabase/migrations/0001_init.sql`
3. Copia tutto il contenuto, incolla nell'editor SQL di Supabase
4. **Run**
5. Verifica: vai su **Database → Tables** → devi vedere `profiles`, `parking_spots`, `feedbacks`, `points_transactions`

### 6.5 (Opzionale) Cron per scadenza automatica spot

```sql
-- Dashboard → Database → Extensions → abilita pg_cron, poi nel SQL Editor:
select cron.schedule(
  'expire-old-spots',
  '* * * * *',
  $$select public.expire_old_spots()$$
);
```

### 6.6 Conferma email automatica (consigliato per dev)

Authentication → Providers → Email:
- Per sviluppo, disabilita "Confirm email" cosi' puoi loggare subito dopo la registrazione
- In produzione riabilitala

### 6.7 Avvio app

```powershell
npm run start
```

Nota: `react-native-maps` su iOS richiede un **Development Build** (non Expo Go).
Su Android funziona in Expo Go.

### 6.8 Test del flusso completo

1. Registra un account → dovresti vedere "Bonus di benvenuto" nello storico punti (profilo)
2. Apri la mappa → permesso GPS → tasto "Segnala parcheggio"
3. Compila la modale → pubblica → torna alla mappa → vedi il tuo pin
4. Logout, registra un secondo account
5. Vai sulla mappa nella stessa zona → vedi il pin del primo account → tap → callout → tap callout → conferma claim (-10 pt)
6. Vai sul profilo del secondo account → vedi transazioni: bonus +50, claim -10

---

## 7. Decisioni di architettura prese

### Perche' Supabase
- Time-to-MVP rapidissimo (auth + PostGIS + realtime + storage gia' pronti)
- PostgreSQL standard → nessun vendor lock-in serio
- Free tier sufficiente fino a qualche migliaio di utenti

### Perche' RPC e non Edge Functions
- Le RPC sono **SQL puro**: portabili a qualsiasi Postgres (Neon, Render, RDS, self-hosted)
- Le Edge Functions Supabase sono Deno → meno portabili
- La logica punti deve essere **atomica e server-side**, le RPC lo garantiscono con transazioni implicite

### Perche' `api/` layer
- Le schermate non chiamano mai `supabase.from(...)` direttamente
- Cambiare backend = sostituire i file in `api/`, le schermate restano identiche
- Facilita anche i test (mock dei file `api/*`)

### Perche' Zustand + React Query
- Zustand per stato globale piccolo e sincrono (session auth)
- React Query per server state (cache, refetch, invalidation) — meglio di mettere tutto in Zustand

---

## 8. Comandi utili

```powershell
# Sviluppo
npm run start              # avvia Metro
npm run android            # Metro + apri Android emulator
npm run ios                # Metro + apri iOS simulator (solo Mac)
npm run web                # versione web

# Lint
npm run lint

# Aggiungere una dipendenza native compatibile con Expo
npx expo install nome-pacchetto

# (Dopo aver creato il progetto Supabase) generare types DB aggiornati
npx supabase gen types typescript --project-id <ID> > types/database.ts
```

---

## 9. File chiave da rileggere se ti perdi

1. `supabase/migrations/0001_init.sql` — tutta la business logic e' qui
2. `api/spots.ts` — wrapper delle RPC, traduce errori in messaggi italiani
3. `app/_layout.tsx` — `AuthGate` che gestisce il routing in base alla sessione
4. `app/(tabs)/index.tsx` — mappa + claim
5. `app/report.tsx` — segnalazione

---

## 10. Repository

- GitHub: https://github.com/branz91/Peter_park_new
- Branch attivo: `main`
