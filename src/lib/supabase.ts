import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in your Supabase project URL and anon key.',
  );
}

export const supabase = createClient(url, anonKey);

export const PHOTOS_BUCKET = 'stitchworks-job-photos';
export const PORTFOLIO_IMAGES_BUCKET = 'stitchworks-portfolio-images';
