import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Pattern-based origin validation to support all Lovable preview URL formats
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  
  // Check custom FRONTEND_URL first
  const frontendUrl = Deno.env.get('FRONTEND_URL');
  if (frontendUrl && origin === frontendUrl) return true;
  
  const ALLOWED_PATTERNS = [
    // Published domain
    /^https:\/\/availabilitygenie\.lovable\.app$/,
    // Local development
    /^http:\/\/localhost:\d+$/,
    // Lovable preview URLs (various formats)
    /^https:\/\/[a-f0-9-]+\.lovable\.app$/,
    /^https:\/\/[a-f0-9-]+\.lovableproject\.com$/,
    /^https:\/\/id-preview--[a-f0-9-]+\.lovable\.app$/,
  ];
  
  return ALLOWED_PATTERNS.some(pattern => pattern.test(origin));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Google OAuth start: Missing or invalid auth header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('Google OAuth start: User authentication failed', { error: userError?.message });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    if (!clientId) {
      console.error('Google OAuth start: GOOGLE_CLIENT_ID not configured');
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { origin } = await req.json();

    // Validate origin using pattern matching
    if (!isAllowedOrigin(origin)) {
      console.log('Google OAuth start: Origin rejected', { origin });
      return new Response(
        JSON.stringify({ error: 'Invalid origin' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-oauth-callback`;
    
    // Debug logging
    console.log('Google OAuth start request:', {
      origin,
      userId,
      hasClientId: !!clientId,
      redirectUri,
    });
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');

    // Include userId in state for callback to store tokens
    const state = btoa(JSON.stringify({ origin, userId }));

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);

    console.log('Google OAuth start: Returning auth URL successfully');

    return new Response(
      JSON.stringify({ url: authUrl.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Google OAuth start error:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to start authentication. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
