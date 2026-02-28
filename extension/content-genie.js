/**
 * Content script injected into the Availability Genie tab.
 *
 * Responsibilities:
 *   1. Forward window.postMessage({ type: 'READ_OUTLOOK_CALENDAR' }) from the
 *      Genie page to the background service worker.
 *   2. Receive relayed Outlook events from the background worker and inject
 *      them back into the page via window.postMessage so useExternalCalendar.ts
 *      picks them up.
 *   3. Relay error messages from the background worker to the page.
 */

// Tell the background worker this is a Genie tab
chrome.runtime.sendMessage({ type: 'GENIE_TAB_READY' }).catch(() => {});

// Listen for requests coming from the Genie React app
window.addEventListener('message', (event) => {
  if (
    event.source === window &&
    event.data?.type === 'READ_OUTLOOK_CALENDAR' &&
    event.data?.source === 'availabilitygenie'
  ) {
    chrome.runtime.sendMessage({ type: 'FETCH_OUTLOOK_EVENTS' }).catch((err) => {
      window.postMessage(
        {
          type: 'OUTLOOK_BRIDGE_ERROR',
          source: 'availabilitygenie-bridge',
          error: 'Extension background worker is unreachable. Try reloading the extension.',
        },
        '*'
      );
    });
  }
});

// Receive events / errors relayed from the background worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RELAY_OUTLOOK_EVENTS') {
    // Inject events into the page so useExternalCalendar.ts handles them
    window.postMessage(
      {
        type: 'OUTLOOK_EVENTS_IMPORTED',
        source: 'availabilitygenie-bridge',
        events: message.events,
      },
      '*'
    );
  }

  if (message.type === 'OUTLOOK_FETCH_ERROR') {
    window.postMessage(
      {
        type: 'OUTLOOK_BRIDGE_ERROR',
        source: 'availabilitygenie-bridge',
        error: message.error,
      },
      '*'
    );
  }
});
