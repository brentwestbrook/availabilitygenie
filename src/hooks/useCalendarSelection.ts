import { useState, useCallback } from 'react';
import { TimeSlot, SelectionState } from '@/types/calendar';
import { addDays, startOfWeek, setHours, setMinutes } from 'date-fns';

export function useCalendarSelection(weekStart: Date) {
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [selectionState, setSelectionState] = useState<SelectionState>({
    isSelecting: false,
    startSlot: null,
    currentSlot: null,
  });

  const getDateFromSlot = useCallback((day: number, hour: number): Date => {
    const date = addDays(weekStart, day);
    return setMinutes(setHours(date, hour), 0);
  }, [weekStart]);

  const handleMouseDown = useCallback((day: number, hour: number) => {
    setSelectionState({
      isSelecting: true,
      startSlot: { day, hour },
      currentSlot: { day, hour },
    });
  }, []);

  const handleMouseMove = useCallback((day: number, hour: number) => {
    if (selectionState.isSelecting && selectionState.startSlot?.day === day) {
      setSelectionState(prev => ({
        ...prev,
        currentSlot: { day, hour },
      }));
    }
  }, [selectionState.isSelecting, selectionState.startSlot?.day]);

  const handleMouseUp = useCallback(() => {
    if (selectionState.isSelecting && selectionState.startSlot && selectionState.currentSlot) {
      const { day } = selectionState.startSlot;
      const startHour = Math.min(selectionState.startSlot.hour, selectionState.currentSlot.hour);
      const endHour = Math.max(selectionState.startSlot.hour, selectionState.currentSlot.hour) + 1;

      const newSlot: TimeSlot = {
        id: `${day}-${startHour}-${endHour}-${Date.now()}`,
        start: getDateFromSlot(day, startHour),
        end: getDateFromSlot(day, endHour),
      };

      setSelectedSlots(prev => [...prev, newSlot]);
    }

    setSelectionState({
      isSelecting: false,
      startSlot: null,
      currentSlot: null,
    });
  }, [selectionState, getDateFromSlot]);

  const clearSelections = useCallback(() => {
    setSelectedSlots([]);
  }, []);

  const removeSelection = useCallback((id: string) => {
    setSelectedSlots(prev => prev.filter(slot => slot.id !== id));
  }, []);

  const getSelectionRange = useCallback(() => {
    if (!selectionState.isSelecting || !selectionState.startSlot || !selectionState.currentSlot) {
      return null;
    }

    const startHour = Math.min(selectionState.startSlot.hour, selectionState.currentSlot.hour);
    const endHour = Math.max(selectionState.startSlot.hour, selectionState.currentSlot.hour);

    return {
      day: selectionState.startSlot.day,
      startHour,
      endHour,
    };
  }, [selectionState]);

  return {
    selectedSlots,
    selectionState,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    clearSelections,
    removeSelection,
    getSelectionRange,
  };
}
