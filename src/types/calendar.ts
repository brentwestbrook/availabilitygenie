export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  source: 'google' | 'microsoft';
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
  startSlot: { day: number; hour: number } | null;
  currentSlot: { day: number; hour: number } | null;
}
