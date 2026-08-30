// This file creates ONE connection object that the rest of our app
// imports and reuses. Think of it like a phone line to the database —
// we set it up once here, then every other file just picks up the
// same phone instead of wiring a brand new line each time.

// Import the function that builds a Supabase connection object.
import { createClient } from '@supabase/supabase-js';

// Read the project URL out of our .env file. Vite (our build tool)
// automatically loads anything starting with VITE_ into
// import.meta.env, which is how frontend code safely reads
// environment variables in the browser.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// Same idea, but for the public "anon" key — this key identifies
// our project, it does NOT grant access to everything (that's what
// the RLS policies in schema.sql are for).
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safety check: if someone runs the app without setting up .env,
// fail loudly and immediately instead of quietly breaking later in
// a confusing way (e.g. every database call silently returning
// nothing, with no clue why).
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Did you create a .env file from .env.example?'
  );
}

// Build the actual connection object using the URL and key above.
// "export" makes this available to any other file in our app via
// `import { supabase } from './lib/supabase'`.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
