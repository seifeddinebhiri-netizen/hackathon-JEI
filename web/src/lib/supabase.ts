import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Client Supabase (clé `anon`, publique : elle ne donne accès qu'à ce que la sécurité par ligne
 * autorise). Null quand VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY sont vides : l'appli garde alors
 * la connexion simulée.
 */
export const supabase: SupabaseClient | null =
  env.supabaseUrl && env.supabaseAnonKey
    ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null;

export const hasRealAuth = supabase !== null;
