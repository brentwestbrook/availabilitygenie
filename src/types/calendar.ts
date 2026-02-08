export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  source: 'google' | 'microsoft' | 'outlook-bridge';
}

export interface TimeSlot {
  id: string;
  start: Date;
  end: Date;
}

export interface CalendarConnection {
  provider: 'google' | 'microsoft';
  connected: boolean;
  email?: string;
}

export interface SelectionState {
  isSelecting: boolean;
  startSlot: { day: number; slotIndex: number } | null;
  currentSlot: { day: number; slotIndex: number } | null;
}

// External event from browser extension
export interface ExternalCalendarEvent {
  start: string; // Time in HH:mm format
  end: string;   // Time in HH:mm format
  day: string | null;
  date: string | null;
  title: string;
  fullLabel?: string;
}

// 30-minute slot configuration
export const SLOT_DURATION_MINUTES = 30;
export const START_HOUR = 7;
export const END_HOUR = 20;
export const SLOTS_PER_HOUR = 60 / SLOT_DURATION_MINUTES;
