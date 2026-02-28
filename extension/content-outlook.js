/**
 * Content script injected into the Outlook Web App tab.
 *
 * When the background worker sends { type: 'FETCH_CALENDAR_EVENTS' }, this
 * script queries OWA's own REST API using the browser's existing authenticated
 * session (cookies sent via credentials: 'include'). No token extraction is
 * needed — the user is already signed in to this tab.
 *
 * Event window: current week start (Sunday) through 4 weeks out (28 days),
 * matching what Availability Genie natively fetches via OAuth.
 */

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'FETCH_CALENDAR_EVENTS') {
    fetchCalendarEvents()
      .then((events) => {
        chrome.runtime.sendMessage({ type: 'OUTLOOK_EVENTS_READY', events });
      })
      .catch((err) => {
        chrome.runtime.sendMessage({
          type: 'OUTLOOK_FETCH_ERROR',
          error: err?.message || 'Unknown error fetching Outlook events.',
        });
      });
  }
});

async function fetchCalendarEvents() {
  const origin = window.location.origin; // e.g. https://outlook.office.com

  const now = new Date();
  // Start of the current week (Sunday midnight local time)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 28);

  const params = new URLSearchParams({
    startDateTime: weekStart.toISOString(),
    endDateTime: weekEnd.toISOString(),
    '$select': 'Subject,Start,End,ShowAs',
    '$top': '100',
    '$orderby': 'Start/DateTime',
  });

  // Use OWA's own REST API — session cookies handle auth, no Bearer token needed.
  // The "Prefer: outlook.timezone=UTC" header tells the server to return all
  // datetimes in UTC so we can parse them unambiguously.
  const resp = await fetch(`${origin}/api/v2.0/me/calendarview?${params.toString()}`, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Prefer': 'outlook.timezone="UTC"',
    },
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(
      resp.status === 401
        ? 'Not signed in to Outlook. Please sign in and try again.'
        : `OWA calendar API error ${resp.status}${body ? ': ' + body.slice(0, 120) : ''}`
    );
  }

  const data = await resp.json();
  const allEvents = data.value || [];

  // Handle pagination (@odata.nextLink)
  let nextLink = data['@odata.nextLink'];
  while (nextLink) {
    const pageResp = await fetch(nextLink, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (!pageResp.ok) break;
    const pageData = await pageResp.json();
    allEvents.push(...(pageData.value || []));
    nextLink = pageData['@odata.nextLink'];
  }

  const pad = (n) => String(n).padStart(2, '0');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return allEvents
    .filter((e) => e.ShowAs !== 'Free') // skip transparent/free events
    .map((e) => {
      // With Prefer: outlook.timezone="UTC", DateTime strings are in UTC.
      // Appending 'Z' ensures JS Date parses them as UTC. getHours()/getDate()
      // then return values in the user's local timezone — which is what we want.
      const startDt = new Date(e.Start.DateTime + 'Z');
      const endDt = new Date(e.End.DateTime + 'Z');

      return {
        title: e.Subject || 'Busy',
        start: `${pad(startDt.getHours())}:${pad(startDt.getMinutes())}`,
        end: `${pad(endDt.getHours())}:${pad(endDt.getMinutes())}`,
        date: `${startDt.getFullYear()}-${pad(startDt.getMonth() + 1)}-${pad(startDt.getDate())}`,
        day: dayNames[startDt.getDay()],
      };
    });
}
