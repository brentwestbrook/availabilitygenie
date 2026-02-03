import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    let origin = '';
    let userId = '';
    try {
      const stateData = JSON.parse(atob(state || ''));
      origin = stateData.origin || '';
      userId = stateData.userId || '';
    } catch {
      origin = '';
    }

    if (error) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?oauth_error=${encodeURIComponent(error)}` },
      });
    }

    if (!code) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?oauth_error=no_code` },
      });
    }

    if (!userId) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?oauth_error=no_user` },
      });
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-oauth-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?oauth_error=${encodeURIComponent(tokens.error)}` },
      });
    }

    // Get user email
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    // Store tokens directly in the database using service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert the connection (update if exists, insert if not)
    const { error: dbError } = await supabase
      .from('calendar_connections')
      .upsert({
        user_id: userId,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        email: userInfo.email,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?oauth_error=database_error` },
      });
    }

    // Redirect with success indicator only (no tokens in URL)
    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}?oauth_success=google` },
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(null, {
      status: 302,
      headers: { Location: `/?oauth_error=server_error` },
    });
  }
});
