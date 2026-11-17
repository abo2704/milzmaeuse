// Verbindung zu Supabase. Beide Werte findest du im Supabase-Dashboard unter
// Project Settings → API (bzw. "API Keys").
// Der Publishable/anon Key ist absichtlich öffentlich – die Daten schützt die
// Row Level Security aus supabase/schema.sql. Den "secret"/"service_role" Key
// hier NIEMALS eintragen.
//
// Solange beide Werte leer sind, läuft die App im Demo-Modus (Daten nur auf diesem Gerät).

export const SUPABASE_URL = 'https://azcsltcyybjpiflbnrhe.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_XvFSr2g7jBMpfzpNWzAQnQ_Y9UFlbCH';
