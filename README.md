# PeterPark

App per **segnalare e trovare parcheggi liberi**, con sistema a punti e feedback.
Stack: **Expo (React Native + Web) + TypeScript + Supabase (PostgreSQL + PostGIS)**.

## Architettura

```
app/                  # File-based routing (expo-router)
  (auth)/             # welcome, login, register
  (tabs)/             # mappa, profilo
  report.tsx          # modale segnalazione

api/                  # Layer di astrazione (auth.ts, spots.ts, profile.ts)
                      # Le schermate chiamano solo queste funzioni, non Supabase.
                      # Cambiare backend = sostituire questi file.

lib/supabase.ts       # Client Supabase configurato
stores/auth.ts        # Stato globale auth (Zustand)
components/           # UI riusabile (Button, TextField, Themed*)
hooks/                # Hook condivisi
constants/theme.ts    # Palette colori + font

supabase/migrations/
  0001_init.sql       # Schema PostGIS + tabelle + RPC + RLS

types/database.ts     # Tipi TypeScript del DB
```

**Principio chiave**: la logica di business (punti, anti-frode, query geo) sta nelle
**RPC PostgreSQL** in `supabase/migrations/0001_init.sql`. Il client NON puo' barare:
gestisce solo UI e chiama le RPC.

## Setup

### 1. Crea il progetto Supabase
- Vai su [supabase.com](https://supabase.com), crea un nuovo progetto.
- Project Settings → API: copia **Project URL** e **anon public key**.

### 2. Configura le variabili d'ambiente
Crea `.env.local` nella root (NON committarlo):

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 3. Esegui la migration SQL
- Supabase Dashboard → **SQL Editor** → New query.
- Incolla il contenuto di `supabase/migrations/0001_init.sql`.
- Run. Crea tabelle, RPC, RLS, trigger e abilita PostGIS.

### 4. Cron job (opzionale ma consigliato)
Per scadere automaticamente le segnalazioni vecchie:
- Dashboard → **Database → Extensions** → abilita `pg_cron`.
- SQL Editor:

```sql
select cron.schedule('expire-old-spots', '* * * * *', $$select public.expire_old_spots()$$);
```

### 5. Avvia l'app

```powershell
npm install
npm run start
```

Per iOS/Android servono **EAS Build** o un Development Build (i mock `expo-go`
non supportano alcuni moduli nativi a lungo termine).

## Sistema a punti (logica server-side)

| Azione                                | Punti  | Note                                                       |
|---------------------------------------|--------|------------------------------------------------------------|
| Registrazione                         | +50    | Bonus iniziale (trigger `tg_handle_new_user`)              |
| Segnalo un parcheggio                 | +5     | RPC `create_parking_spot` (provvisori)                     |
| Un altro lo prende e conferma         | +10    | RPC `submit_feedback` (was_available=true)                 |
| Lascio un feedback                    | +2     | Bonus engagement                                           |
| Prendo un parcheggio                  | -10    | RPC `claim_parking_spot`                                   |
| 2+ feedback negativi sulla mia spot   | -20    | Reputazione abbassata, spot marcata invalida               |

Anti-spam:
- Max 5 segnalazioni / 24h per utente
- Distanza minima 50m tra segnalazioni attive dello stesso utente

## Schermate

- **Welcome / Login / Register** → autenticazione con email + password
- **Mappa (home)** → mostra parcheggi attivi nel raggio di 1km, refresh ogni 15s
- **Modale segnalazione** → tipo parcheggio, durata, note, posizione GPS
- **Profilo** → punti correnti, statistiche, storico transazioni, logout

## Roadmap prossimi step

- [ ] Realtime: push live nuovi spot via `supabase.channel().on('postgres_changes', ...)`
- [ ] Geofencing arrivo → notifica "Sei arrivato? lascia feedback"
- [ ] Foto del parcheggio (Supabase Storage)
- [ ] Cluster marker quando densita' alta (`react-native-maps-clustering`)
- [ ] Mock location detection
- [ ] i18n (it/en)
- [ ] Sentry per error tracking
- [ ] Apple/Google Sign-In
- [ ] Notifiche push (`expo-notifications`)
