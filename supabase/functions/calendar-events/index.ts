import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider, accessToken, startDate, endDate } = await req.json();

    if (!provider || !accessToken) {
      throw new Error('Missing required parameters');
    }

    let events = [];

    if (provider === 'google') {
      events = await fetchGoogleEvents(accessToken, startDate, endDate);
    } else if (provider === 'microsoft') {
      events = await fetchMicrosoftEvents(accessToken, startDate, endDate);
    } else {
      throw new Error('Invalid provider');
    }

    return new Response(
      JSON.stringify({ events }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchGoogleEvents(accessToken: string, startDate: string, endDate: string) {
  const calendarId = 'primary';
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
  url.searchParams.set('timeMin', startDate);
  url.searchParams.set('timeMax', endDate);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '100');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch Google events');
  }

  const data = await response.json();

  return (data.items || []).map((event: any) => ({
    id: event.id,
    title: event.summary || 'Busy',
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    source: 'google',
  }));
}

async function fetchMicrosoftEvents(accessToken: string, startDate: string, endDate: string) {
  const url = new URL('https://graph.microsoft.com/v1.0/me/calendarView');
  url.searchParams.set('startDateTime', startDate);
  url.searchParams.set('endDateTime', endDate);
  url.searchParams.set('$top', '100');
  url.searchParams.set('$select', 'id,subject,start,end');
  url.searchParams.set('$orderby', 'start/dateTime');

  const response = await fetch(url.toString(), {
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Prefer': 'outlook.timezone="UTC"',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch Microsoft events');
  }

  const data = await response.json();

  return (data.value || []).map((event: any) => ({
    id: event.id,
    title: event.subject || 'Busy',
    start: event.start?.dateTime,
    end: event.end?.dateTime,
    source: 'microsoft',
  }));
}
