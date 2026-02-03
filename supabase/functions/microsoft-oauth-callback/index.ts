import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

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
        headers: { Location: `${origin}?error=${encodeURIComponent(errorDescription || error)}` },
      });
    }

    if (!code) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?error=no_code` },
      });
    }

    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
    const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/microsoft-oauth-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
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
        headers: { Location: `${origin}?error=${encodeURIComponent(tokens.error_description || tokens.error)}` },
      });
    }

    // Get user email from Microsoft Graph
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    // Create connection record
    const connectionData = {
      provider: 'microsoft',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      email: userInfo.mail || userInfo.userPrincipalName,
    };

    // Encode the connection data to pass to frontend
    const encodedData = btoa(JSON.stringify(connectionData));

    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}?microsoft_connection=${encodedData}` },
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
