/**
 * ISOLATED WORLD content script — injected into Outlook Web App tabs at document_start.
 *
 * Works in tandem with content-outlook-main.js:
 *   - The MAIN world script patches window.fetch/XHR and emits captured Graph tokens
 *     via window.postMessage({ type: 'AG_TOKEN_CAPTURED', token }).
 *   - This script listens for those messages and caches the latest valid token.
 *   - When the background worker sends { type: 'FETCH_CALENDAR_EVENTS' }, this script
 *     uses the cached token to query Microsoft Graph for calendar events, then sends
 *     the results back to the background.
 *
 * Event window: current week start (Sunday) through 4 weeks out (28 days),
 * matching what Availability Genie natively fetches via OAuth.
 */

let cachedToken = null;

// Receive tokens forwarded by the MAIN world fetch interceptor
window.addEventListener('message', (event) => {
  if (event.source === window && event.data?.type === 'AG_TOKEN_CAPTURED' && event.data?.token) {
    cachedToken = event.data.token;
  }
});

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
  if (!cachedToken) {
    throw new Error(
      'No Outlook session token captured yet. ' +
      'Make sure the Outlook calendar tab is open and has finished loading, then try again.'
    );
  }

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
    '$select': 'subject,start,end,showAs',
    '$top': '100',
    '$orderby': 'start/dateTime',
  });

  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${cachedToken}`,
        'Accept': 'application/json',
      },
    }
  );

  if (resp.status === 401) {
    // Token likely expired; clear it so the next sync waits for a fresh one
    cachedToken = null;
    throw new Error(
      'Outlook session token expired. ' +
      'The Outlook tab will refresh it automatically — please wait a moment and try again.'
    );
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Graph API error ${resp.status}${body ? ': ' + body.slice(0, 120) : ''}`);
  }

  const data = await resp.json();
  const allEvents = data.value || [];

  // Handle pagination (@odata.nextLink)
  let nextLink = data['@odata.nextLink'];
  while (nextLink) {
    const pageResp = await fetch(nextLink, {
      headers: {
        'Authorization': `Bearer ${cachedToken}`,
        'Accept': 'application/json',
      },
    });
    if (!pageResp.ok) break;
    const pageData = await pageResp.json();
    allEvents.push(...(pageData.value || []));
    nextLink = pageData['@odata.nextLink'];
  }

  const pad = (n) => String(n).padStart(2, '0');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return allEvents
    .filter((e) => e.showAs !== 'free') // skip transparent/free events
    .map((e) => {
      // Graph returns datetimes like "2026-03-02T09:30:00.0000000" in the event's
      // local timezone (specified in e.start.timeZone). Appending 'Z' would wrongly
      // treat it as UTC. Instead parse as a local-time string directly.
      const startDt = parseGraphDateTime(e.start.dateTime);
      const endDt = parseGraphDateTime(e.end.dateTime);

      return {
        title: e.subject || 'Busy',
        start: `${pad(startDt.getHours())}:${pad(startDt.getMinutes())}`,
        end: `${pad(endDt.getHours())}:${pad(endDt.getMinutes())}`,
        date: `${startDt.getFullYear()}-${pad(startDt.getMonth() + 1)}-${pad(startDt.getDate())}`,
        day: dayNames[startDt.getDay()],
      };
    });
}

/**
 * Parses a Microsoft Graph datetime string (e.g. "2026-03-02T09:30:00.0000000")
 * as LOCAL time. Graph returns event datetimes in the calendar's configured timezone;
 * since we want to display them in the user's local time we treat the string as local.
 * (If the calendar timezone differs from the system timezone times will be off by the
 * delta — acceptable for the use case of showing busy blocks.)
 */
function parseGraphDateTime(dateTimeStr) {
  // Strip sub-second precision that JS Date can't always handle
  const normalized = dateTimeStr.replace(/(\.\d+)?$/, '');
  return new Date(normalized); // No trailing Z → treated as local time by JS
}
