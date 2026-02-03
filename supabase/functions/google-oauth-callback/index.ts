import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    let origin = '';
    try {
      const stateData = JSON.parse(atob(state || ''));
      origin = stateData.origin || '';
    } catch {
      origin = '';
    }

    if (error) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?error=${encodeURIComponent(error)}` },
      });
    }

    if (!code) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?error=no_code` },
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
        headers: { Location: `${origin}?error=${encodeURIComponent(tokens.error)}` },
      });
    }

    // Get user email
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    // Create connection record with a temporary token that frontend will use
    const connectionData = {
      provider: 'google',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      email: userInfo.email,
    };

    // Encode the connection data to pass to frontend
    const encodedData = btoa(JSON.stringify(connectionData));

    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}?google_connection=${encodedData}` },
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(null, {
      status: 302,
      headers: { Location: `/?error=${encodeURIComponent(message)}` },
    });
  }
});
