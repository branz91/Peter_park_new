# PeterPark — Stato del progetto

> Documento di handover. Serve a riprendere il lavoro su un altro computer
> (in particolare per la parte SQL/Supabase che non puo' essere fatta su ARM).
>
> **Ultimo aggiornamento:** vedi data dell'ultimo commit sul branch `main`.

---

## 1. Cos'e' PeterPark (in breve)

App mobile + web per **segnalare e trovare parcheggi liberi**, con:

- **Sistema a punti**: bonus iniziale 50 punti, **+10 al reporter SOLO quando un altro utente conferma con feedback positivo** (niente bonus immediato alla creazione), +2 per ogni feedback, -10 per prenotare un parcheggio, -20 al reporter su 2 feedback negativi.
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

### Realtime mappa (FATTO)

- [x] Hook `hooks/use-spots-realtime.ts` che sottoscrive il channel `parking_spots_changes`
- [x] La mappa (`app/(tabs)/index.tsx`) invalida la query su ogni INSERT/UPDATE/DELETE
- [x] Polling ridotto a 60s come fallback (non piu' 15s)

### Ricerca parcheggi "in questa zona" (FATTO)

- [x] `lib/geo.ts`: `haversineMeters()` + `radiusFromRegion()` (nessuna dipendenza esterna)
- [x] La query non e' piu' legata al solo GPS: si puo' spostare/zoomare la mappa
- [x] Pulsante flottante "Cerca in questa zona" quando ci si sposta oltre soglia (30% del raggio, min 150m)
- [x] Raggio di ricerca calcolato dallo zoom visibile (min 300m, max 20km), limite risultati alzato a 50
- [x] Pulsante FAB per ri-centrarsi sulla propria posizione
- [x] Icona `magnifyingglass` -> `search` aggiunta al mapping `components/ui/icon-symbol.tsx`

### Ricerca per indirizzo + tipo mappa + migliorie mappa (FATTO)

- [x] Barra di ricerca in alto: geocoding on-device con `Location.geocodeAsync` (nessuna API key), la mappa salta all'indirizzo
- [x] Toggle tipo mappa: `standard` (stilizzata) <-> `hybrid` (satellite con etichette vie)
- [x] Cerchio (`Circle`) che mostra visivamente il raggio di ricerca corrente
- [x] Contatore risultati nella barra inferiore ("N parcheggi in questa zona")
- [x] Pulsante "x" per svuotare la ricerca; icone `globe`/`map`/`xmark.circle.fill` aggiunte al mapping
- [x] Callout ricco sul pin: tipo parcheggio, reporter, distanza, scadenza ("Scade tra N min"), note. Tap sul callout apre un menu azioni **Naviga** (apre Apple/Google Maps via `Linking`) / **Prenota (-10)**. Un solo alert, niente doppia conferma.
- [x] Stato "senza posizione" gestito con UI amichevole (icona + titolo + messaggio per stato: denied / services_off / non disponibile) e pulsante **Apri impostazioni** (`Linking.openSettings()`) + Riprova. Niente piu' messaggi d'errore tecnici. Stato `loading` con spinner.
- [x] Barra di ricerca ancorata sotto la status bar usando `useSafeAreaInsets` (`SafeAreaProvider` + `initialWindowMetrics` aggiunti in `components/providers.tsx`) — non si sovrappone piu' a notch/icone di sistema.

Nota geocoding: usa il geocoder di sistema (Apple su iOS, ottimo). Se in futuro
serve autocomplete/precisione maggiore, valutare Google Places (richiede key).

### Punto manuale (gocciolina) + raggio (FATTO)

Mappa (`app/(tabs)/index.tsx`):
- [x] Pulsante "gocciolina" tra i controlli mappa (o **tieni premuto** sulla mappa) per posizionare un punto di ricerca manuale. Il marker rosso e' **trascinabile** per rifinire.
- [x] Con il punto attivo, nella barra inferiore compare il selettore **raggio di ricerca** (250 m / 500 m / 1 / 2 / 5 km) + "Rimuovi punto".
- [x] Il `Circle` riflette il raggio scelto; ricerca ancorata al punto (niente "Cerca in questa zona" in questa modalita').
- [x] Indirizzo / ricentra / "Cerca qui" azzerano il punto manuale.

Report (`app/report.tsx`):
- [x] Mini-mappa con gocciolina fissa al centro (la mappa scorre sotto): il parcheggio viene segnalato sul punto scelto, non piu' solo sul GPS.
- [x] Pulsante "usa la mia posizione" per ricentrare sul GPS. Default = posizione attuale.
- [x] Icona `mappin.circle.fill` -> `place` aggiunta al mapping.

### Foto parcheggio (DISABILITATE per tenere il DB leggero)

- Il codice foto in `app/report.tsx` e' **commentato** (import, stato `photo`, `pickPhoto`, blocco UI, upload). Riattivabile in futuro togliendo i commenti.
- `api/storage.ts` e la migration `0002_storage.sql` restano in repo ma inutilizzati.
- `photo_url` viene sempre inviato `null` alle RPC.
- Nota: il plugin `expo-image-picker` e i permessi camera/foto sono ancora in `app.json`. Se si vuole un build davvero snello (ed evitare domande Apple sui permessi inutilizzati), rimuovere quel plugin — ma e' un cambio nativo che richiede un nuovo build.

### Feedback dopo claim (FATTO)

- [x] `app/feedback.tsx`: form con "era libero?" + voto opzionale + commento
- [x] Dopo il claim, l'Alert offre il pulsante "Dai feedback ora" che apre la schermata
- [x] Mapping errore `feedbacks_spot_id_user_id_key` (un solo feedback per spot per utente) in `api/spots.ts`

### Foto parcheggio (FATTO — richiede migration 0002)

- [x] `expo-image-picker` installato e configurato in `app.json`
- [x] `api/storage.ts` con `uploadSpotPhoto(userId, fileUri, contentType?)`
- [x] `app/report.tsx`: pulsanti "Scatta foto" / "Dalla galleria", preview con `expo-image`, upload prima del create
- [x] Migration `supabase/migrations/0002_storage.sql`: bucket `spot-photos` (public read) + 4 policy (insert/update/delete solo nella propria cartella `<user_id>/*`)
- [ ] **Da applicare in Supabase**: copia/incolla `0002_storage.sql` nel SQL Editor (come hai gia' fatto per 0001)

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

- [x] **Applicare la migration SQL su Supabase** (0001 fatto)
- [ ] **Applicare la migration 0002_storage.sql** per abilitare le foto (vedi sezione 6.4 bis)
- [ ] **Applicare la migration 0003_points_only_on_confirm.sql** per togliere i +5 immediati al report
- [ ] **Test end-to-end** del flusso completo (registrazione → segnalazione → claim → feedback) per verificare che tutte le RPC funzionino
- [x] **Realtime live**: sottoscrizione `supabase.channel().on('postgres_changes', ...)` nella mappa per vedere comparire nuovi spot senza polling
- [x] **Foto parcheggio**: Supabase Storage + `expo-image-picker`; il campo `photo_url` e' gia' nel DB
- [ ] **Banner "prenotazione senza feedback"** sulla mappa per chi chiude l'alert post-claim (oggi se l'utente sceglie "Piu tardi" non ha piu' un punto di ingresso al form feedback)

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

### 6.4 bis Applica la migration 0002 (bucket foto)

1. Apri `supabase/migrations/0002_storage.sql`
2. Copia tutto, incollalo nel SQL Editor di Supabase, **Run**
3. Verifica: vai su **Storage** → deve esserci il bucket `spot-photos` (Public)
4. Verifica policy: **Database → Policies → storage.objects** → vedi 4 policy `spot_photos_*`

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

---

## 11. Distribuzione (far provare l'app a un beta tester iOS)

Identifier gia' configurato in `app.json`:

- `ios.bundleIdentifier = com.peterpark.app`
- `android.package = com.peterpark.app`

Credenziali Apple gia' inserite in `eas.json`:

- `submit.production.ios.appleTeamId = HX29Y774Y3`

E' presente un `eas.json` con i profili `development`, `preview`, `preview-simulator`, `production`.

### 11.A Test rapido senza spendere nulla (Expo Go + tunnel)

Per una demo veloce in chiamata col cliente:

```powershell
npx expo start --tunnel
```

La prima volta verra' installato `@expo/ngrok`. Quando il dev server e' pronto, mandi al cliente il link `exp://...` o uno screenshot del QR. Lui:

1. Scarica **Expo Go** dall'App Store.
2. Tap sul link (o scansiona il QR dalla fotocamera iOS) → apre Expo Go → l'app si carica.

**Cosa puo' non funzionare in Expo Go**:
- La fotocamera per le foto (la galleria invece OK).
- Eventuali altri moduli nativi non bundled in Expo Go (raro su SDK 54).

E' una soluzione temporanea che richiede il tuo PC acceso col tunnel attivo.

### 11.B Beta vera su iPhone via TestFlight

Richiede **Apple Developer Program** (~99 USD/anno) → [developer.apple.com/programs](https://developer.apple.com/programs/). Approvazione 1-3 giorni.

Una volta che hai l'account attivo:

```powershell
npm install -g eas-cli
eas login
eas init               # collega il progetto al cloud EAS (solo la prima volta)

# Build IPA per beta interna / TestFlight
eas build --platform ios --profile preview

# Quando vuoi caricarla su TestFlight:
eas submit -p ios --latest
```

Durante il primo build, EAS ti chiedera' le credenziali Apple e creera' automaticamente:
- Distribution certificate
- Provisioning profile
- App identifier su App Store Connect

Tutto via prompt, niente Xcode.

Dopo il submit:
1. Vai su [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. La tua app → tab **TestFlight** → la build apparira' "Processing" per ~10 min poi "Ready to Submit".
3. **External Testing** → crea un gruppo → aggiungi l'email del cliente → invia inviti.
4. Il cliente scarica **TestFlight** dall'App Store, apre il link dell'invito, installa PeterPark come app vera.

La prima build esterna richiede una revisione Apple di ~24h. Le successive sono immediate.

### 11.B bis APK Android per test (nessuno store, nessun account a pagamento)

Android non richiede Apple Developer ne' revisione: si genera un **APK** installabile
direttamente (basta abilitare "installa da sorgenti sconosciute" sul telefono).

Il profilo `preview` in `eas.json` produce un APK (`distribution: internal` +
`android.buildType: apk`). Il keystore viene creato/gestito automaticamente da EAS
(credenziali remote), niente da fare a mano.

```powershell
eas build --platform android --profile preview
```

A build finita EAS stampa un link `https://expo.dev/artifacts/eas/....apk` (e un QR):
lo mandi al tester, lui scarica e installa. Le variabili Supabase vengono lette
dall'ambiente `preview` su EAS (gia' configurate), quindi l'APK si collega al DB
senza passaggi extra.

### 11.C Aggiornare l'app del tester senza ribuildare (EAS Update / OTA)

Per fix o feature **solo JS/asset** (niente nuove dipendenze native) NON serve
rifare la build: si pubblica un update OTA sullo stesso canale della build gia'
installata. L'app lo scarica al successivo avvio.

**Vincolo fondamentale**: l'update raggiunge solo le build con la **stessa
`runtimeVersion`** (qui = `expo.version` di `app.json`, policy `appVersion`) e
sullo stesso **canale**. Se alzi `expo.version`, "scolleghi" l'OTA dalle build
vecchie.

Stato attuale (aggiornato al 2026-07-09):

- Build iOS live su TestFlight: **`1.0.0` (build 2)**, canale `production`, `runtimeVersion 1.0.0`.
- Per questo `expo.version` e' tenuto a **`1.0.0`**: cosi' gli OTA su `production` raggiungono quella build.

Comando usato per applicare le ultime feature (pin manuale, raggio, selettore
posizione nel report, ecc.) alla build iOS gia' caricata:

```powershell
$env:CI=1        # `--non-interactive` non e' supportato da `eas update`
eas update --branch production --platform ios --message "descrizione modifiche"
```

**IMPORTANTE — build solo iOS/Android, mai `--platform all`**: `react-native-maps`
non e' compatibile col bundle **web** (importa `codegenNativeCommands`, native-only).
Dato che `app/report.tsx` e `app/(tabs)/index.tsx` importano `react-native-maps`,
un export web (`--platform all`, default) **fallisce**. Specifica sempre
`--platform ios` (o `android`). L'app mobile non e' toccata; il target web non e'
usato.

Per il canale interno di test Android vale lo stesso:

```powershell
$env:CI=1
eas update --branch preview --platform android --message "..."
```

### 11.C bis Versione fissata di `@supabase/supabase-js`

Versione corrente: **`2.105.4` (fissa, niente caret)**.

Motivo: le versioni `2.106.0` e `2.106.1` aggiungono un `import()` dinamico per
OpenTelemetry che Hermes (motore JS di RN release builds su iOS e Android)
rifiuta in fase di parse:

```
main.jsbundle: error: Invalid expression encountered
... otelModulePromise = import(/* webpackIgnore: true */ OTEL_PKG)
```

→ rompe le build EAS sia su iOS che Android (vedi
[supabase/supabase-js#2380](https://github.com/supabase/supabase-js/issues/2380)).

Quando esce la `2.106.2` stable (il fix e' in `2.106.2-canary.0` del 2026-05-22),
possiamo riaggiornare.

### 11.C ter Google Maps API key su Android (OBBLIGATORIA per l'APK)

Sintomo: in `expo start` / Expo Go tutto ok, ma nell'**APK standalone l'app
crasha** appena si apre la mappa (la prima scheda dopo il login). Con la new
architecture attiva il crash e' immediato.

Causa: `react-native-maps` su Android usa Google Maps e richiede una
**Google Maps API key** nel manifest. Expo Go usa la propria chiave, quindi in
dev non si nota; l'APK invece non ne ha una → crash della view nativa.

Fix implementato:

- `app.config.js` (config dinamica sopra `app.json`) inietta la chiave in
  `android.config.googleMaps.apiKey` leggendola dalla variabile d'ambiente
  `GOOGLE_MAPS_API_KEY` (cosi' non finisce nel repo).
- La chiave e' salvata negli Environment EAS `preview` e `production`
  (`eas env:create --name GOOGLE_MAPS_API_KEY ...`) e in `.env.local` per i dev
  build locali.
- Verifica config: `npx expo config --type prebuild --json` → deve mostrare
  `android.config.googleMaps.apiKey`.

Chiave creata su Google Cloud → **Maps SDK for Android** abilitata → credenziale
Chiave API. **Da restringere** (App Android: package `com.peterpark.app` +
SHA-1 del keystore EAS, ottenibile con `eas credentials -p android`) e limitare
alla sola Maps SDK for Android.

Nota iOS: usa Apple Maps di default, quindi **non serve** una chiave Google su iOS.

### 11.D Note operative

- **Versioning**: `eas build --profile production` ha `autoIncrement: true` quindi gestisce da solo `buildNumber` (iOS) e `versionCode` (Android). Attenzione pero': `expo.version` = `runtimeVersion` (policy `appVersion`). Se vuoi ancora spingere OTA sulla build 1.0.0 live, **NON** alzare `expo.version`. Alzalo solo quando fai una **nuova build nativa** (che avra' un nuovo runtime e un suo canale OTA).
- **Variabili d'ambiente**: i valori in `.env.local` non finiscono in build! Vanno configurati su EAS con `eas env:create` (es. `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) oppure nel dashboard EAS → Environment Variables.
- **App icon e splash**: per ora sono i placeholder Expo. Prima di pubblicare in produzione vanno sostituiti con le grafiche reali in `assets/images/`.
- **Privacy nutrition label**: prima del primo submit su App Store Connect ti chiederanno di dichiarare cosa raccogli (posizione, email per auth, foto opzionali). Va compilato a mano una volta.
