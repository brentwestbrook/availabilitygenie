import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../_shared/encryption.ts";

serve(async (req) => {
  console.log('Google OAuth callback: Request received');
  
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('Google OAuth callback params:', {
      hasCode: !!code,
      hasState: !!state,
      error,
    });

    let origin = '';
    let userId = '';
    try {
      const stateData = JSON.parse(atob(state || ''));
      origin = stateData.origin || '';
      userId = stateData.userId || '';
      console.log('Google OAuth callback: State decoded', { origin, userId });
    } catch (e) {
      console.error('Google OAuth callback: Failed to decode state', e);
      origin = '';
    }

    if (error) {
      console.log('Google OAuth callback: OAuth error from provider', { error });
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?oauth_error=${encodeURIComponent(error)}` },
      });
    }

    if (!code) {
      console.log('Google OAuth callback: No code received');
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?oauth_error=no_code` },
      });
    }

    if (!userId) {
      console.log('Google OAuth callback: No user ID in state');
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?oauth_error=no_user` },
      });
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-oauth-callback`;

    console.log('Google OAuth callback: Exchanging code for tokens', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      redirectUri,
    });

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

    console.log('Google OAuth callback: Token exchange result', {
      success: !tokens.error,
      error: tokens.error,
      errorDescription: tokens.error_description,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });

    if (tokens.error) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?oauth_error=${encodeURIComponent(tokens.error_description || tokens.error)}` },
      });
    }

    // Get user email
    console.log('Google OAuth callback: Fetching user info');
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();
    
    console.log('Google OAuth callback: User info fetched', {
      hasEmail: !!userInfo.email,
      email: userInfo.email,
    });

    // Encrypt tokens before storing
    console.log('Google OAuth callback: Encrypting tokens');
    const encryptedAccess = await encryptToken(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token 
      ? await encryptToken(tokens.refresh_token) 
      : null;

    // Store encrypted tokens in the database using service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Google OAuth callback: Upserting to database', { userId, provider: 'google' });

    // Upsert the connection with encrypted tokens
    const { error: dbError } = await supabase
      .from('calendar_connections')
      .upsert({
        user_id: userId,
        provider: 'google',
        access_token: encryptedAccess.encrypted,
        access_token_iv: encryptedAccess.iv,
        access_token_tag: encryptedAccess.tag,
        refresh_token: encryptedRefresh?.encrypted || null,
        refresh_token_iv: encryptedRefresh?.iv || null,
        refresh_token_tag: encryptedRefresh?.tag || null,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        email: userInfo.email,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      });

    console.log('Google OAuth callback: Database upsert result', {
      success: !dbError,
      error: dbError?.message,
      code: dbError?.code,
    });

    if (dbError) {
      console.error('Google OAuth callback: Database error:', dbError);
      return new Response(null, {
        status: 302,
        headers: { Location: `${origin}?oauth_error=database_error` },
      });
    }

    console.log('Google OAuth callback: Success! Redirecting with oauth_success=google');
    
    // Redirect with success indicator only (no tokens in URL)
    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}?oauth_success=google` },
    });
  } catch (error: unknown) {
    console.error('Google OAuth callback: Unexpected error:', error);
    return new Response(null, {
      status: 302,
      headers: { Location: `/?oauth_error=server_error` },
    });
  }
});
