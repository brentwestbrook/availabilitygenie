/**
 * Background service worker for Availability Genie – Outlook Bridge.
 *
 * Coordinates two content scripts:
 *   - content-genie.js  (runs on the Availability Genie tab)
 *   - content-outlook.js (runs on the Outlook Web App tab)
 *
 * Message flow:
 *   1. Genie page fires window.postMessage({ type: 'READ_OUTLOOK_CALENDAR' })
 *   2. content-genie.js forwards it here as { type: 'FETCH_OUTLOOK_EVENTS' }
 *   3. We find the Outlook tab and tell content-outlook.js to fetch events
 *   4. content-outlook.js fetches events from Microsoft Graph and replies
 *   5. We relay the events back to the Genie tab via content-genie.js
 *   6. content-genie.js injects them into the page with window.postMessage
 *
 * The extension icon (toolbar button) also triggers a sync manually.
 */

// Track which tab is the Genie tab so we can reply to it
const genieTabs = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderTabId = sender.tab?.id;

  if (message.type === 'GENIE_TAB_READY') {
    if (senderTabId !== undefined) genieTabs.add(senderTabId);
    return;
  }

  if (message.type === 'FETCH_OUTLOOK_EVENTS') {
    // Genie is requesting events — find an Outlook tab and ask it
    if (senderTabId !== undefined) genieTabs.add(senderTabId);
    fetchFromOutlookTab(senderTabId);
    return;
  }

  if (message.type === 'OUTLOOK_EVENTS_READY') {
    // content-outlook.js has returned events — relay to all Genie tabs
    const events = message.events || [];
    for (const tabId of genieTabs) {
      chrome.tabs.sendMessage(tabId, { type: 'RELAY_OUTLOOK_EVENTS', events }).catch(() => {
        genieTabs.delete(tabId);
      });
    }
    return;
  }

  if (message.type === 'OUTLOOK_FETCH_ERROR') {
    for (const tabId of genieTabs) {
      chrome.tabs.sendMessage(tabId, { type: 'OUTLOOK_FETCH_ERROR', error: message.error }).catch(() => {
        genieTabs.delete(tabId);
      });
    }
    return;
  }
});

// When the toolbar icon is clicked, trigger a manual sync.
// Find the open Genie tab by URL so errors are displayed there regardless of
// which tab was active when the icon was clicked.
chrome.action.onClicked.addListener(async (tab) => {
  const geniePatterns = [
    'https://availability.brentwestbrook.com/*',
    'http://localhost:*/*',
  ];

  let genieTabId = tab.id; // fallback: the clicked tab
  for (const pattern of geniePatterns) {
    const found = await chrome.tabs.query({ url: pattern });
    if (found.length > 0 && found[0].id !== undefined) {
      genieTabId = found[0].id;
      break;
    }
  }

  if (genieTabId !== undefined) genieTabs.add(genieTabId);
  fetchFromOutlookTab(genieTabId);
});

// Keyboard shortcut: Ctrl+Shift+A — focus/open Genie tab then sync
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'sync-and-focus') return;

  const geniePatterns = [
    'https://availability.brentwestbrook.com/*',
    'http://localhost:*/*',
  ];

  let genieTab = null;
  for (const pattern of geniePatterns) {
    const found = await chrome.tabs.query({ url: pattern });
    if (found.length > 0) { genieTab = found[0]; break; }
  }

  if (genieTab && genieTab.id !== undefined) {
    // Focus the existing tab
    await chrome.tabs.update(genieTab.id, { active: true });
    if (genieTab.windowId !== undefined) {
      await chrome.windows.update(genieTab.windowId, { focused: true });
    }
    genieTabs.add(genieTab.id);
    fetchFromOutlookTab(genieTab.id);
  } else {
    // Open Genie in a new tab then sync once it's ready
    const newTab = await chrome.tabs.create({ url: 'https://availability.brentwestbrook.com/' });
    if (newTab.id !== undefined) genieTabs.add(newTab.id);
    // content-genie.js will send GENIE_TAB_READY when the page loads;
    // the user can then click Read Outlook Calendar or press the shortcut again.
  }
});

async function fetchFromOutlookTab(requestingTabId) {
  const outlookPatterns = [
    'https://outlook.office.com/*',
    'https://outlook.office365.com/*',
    'https://outlook.live.com/*',
    'https://outlook.cloud.microsoft/*',
  ];

  let outlookTab = null;

  for (const pattern of outlookPatterns) {
    const tabs = await chrome.tabs.query({ url: pattern });
    if (tabs.length > 0) {
      outlookTab = tabs[0];
      break;
    }
  }

  if (!outlookTab || outlookTab.id === undefined) {
    // No Outlook tab open — notify Genie
    if (requestingTabId !== undefined) {
      chrome.tabs.sendMessage(requestingTabId, {
        type: 'OUTLOOK_FETCH_ERROR',
        error: 'No Outlook tab found. Please open Outlook Web App in another tab and try again.',
      }).catch(() => {});
    }
    return;
  }

  // Ask the Outlook content script to fetch events
  chrome.tabs.sendMessage(outlookTab.id, { type: 'FETCH_CALENDAR_EVENTS' }).catch((err) => {
    if (requestingTabId !== undefined) {
      chrome.tabs.sendMessage(requestingTabId, {
        type: 'OUTLOOK_FETCH_ERROR',
        error: 'Could not communicate with the Outlook tab. Try reloading it.',
      }).catch(() => {});
    }
  });
}
