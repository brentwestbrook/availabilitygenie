import { useState, useCallback } from 'react';
import { TimeSlot, SelectionState, SLOT_DURATION_MINUTES, START_HOUR, SLOTS_PER_HOUR } from '@/types/calendar';
import { addDays, addMinutes, setHours, setMinutes, isSameDay } from 'date-fns';

export function useCalendarSelection(weekStart: Date) {
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [selectionState, setSelectionState] = useState<SelectionState>({
    isSelecting: false,
    startSlot: null,
    currentSlot: null,
  });

  const getDateFromSlot = useCallback((day: number, slotIndex: number): Date => {
    const date = addDays(weekStart, day);
    const hour = START_HOUR + Math.floor(slotIndex / SLOTS_PER_HOUR);
    const minutes = (slotIndex % SLOTS_PER_HOUR) * SLOT_DURATION_MINUTES;
    return setMinutes(setHours(date, hour), minutes);
  }, [weekStart]);

  const handleMouseDown = useCallback((day: number, slotIndex: number) => {
    setSelectionState({
      isSelecting: true,
      startSlot: { day, slotIndex },
      currentSlot: { day, slotIndex },
    });
  }, []);

  const handleMouseMove = useCallback((day: number, slotIndex: number) => {
    if (selectionState.isSelecting && selectionState.startSlot?.day === day) {
      setSelectionState(prev => ({
        ...prev,
        currentSlot: { day, slotIndex },
      }));
    }
  }, [selectionState.isSelecting, selectionState.startSlot?.day]);

  const handleMouseUp = useCallback(() => {
    if (selectionState.isSelecting && selectionState.startSlot && selectionState.currentSlot) {
      const { day } = selectionState.startSlot;
      const startSlotIndex = Math.min(selectionState.startSlot.slotIndex, selectionState.currentSlot.slotIndex);
      const endSlotIndex = Math.max(selectionState.startSlot.slotIndex, selectionState.currentSlot.slotIndex) + 1;

      const clickedStart = getDateFromSlot(day, startSlotIndex);
      const clickedEnd = addMinutes(clickedStart, (endSlotIndex - startSlotIndex) * SLOT_DURATION_MINUTES);
      const clickedStartMinutes = clickedStart.getHours() * 60 + clickedStart.getMinutes();
      const clickedEndMinutes = clickedEnd.getHours() * 60 + clickedEnd.getMinutes();

      // Find slots that overlap with clicked area
      const overlappingSlots = selectedSlots.filter(slot => {
        if (!isSameDay(slot.start, clickedStart)) return false;
        const slotStartMinutes = slot.start.getHours() * 60 + slot.start.getMinutes();
        const slotEndMinutes = slot.end.getHours() * 60 + slot.end.getMinutes();
        return clickedStartMinutes < slotEndMinutes && clickedEndMinutes > slotStartMinutes;
      });

      if (overlappingSlots.length > 0) {
        // Split overlapping slots, removing only the clicked portion
        const newSlots: TimeSlot[] = [];
        const slotsToRemove = new Set(overlappingSlots.map(s => s.id));

        overlappingSlots.forEach(slot => {
          const slotStartMinutes = slot.start.getHours() * 60 + slot.start.getMinutes();
          const slotEndMinutes = slot.end.getHours() * 60 + slot.end.getMinutes();

          // Keep portion before clicked area
          if (slotStartMinutes < clickedStartMinutes) {
            newSlots.push({
              id: `${day}-before-${Date.now()}-${Math.random()}`,
              start: slot.start,
              end: clickedStart,
            });
          }

          // Keep portion after clicked area
          if (slotEndMinutes > clickedEndMinutes) {
            newSlots.push({
              id: `${day}-after-${Date.now()}-${Math.random()}`,
              start: clickedEnd,
              end: slot.end,
            });
          }
        });

        setSelectedSlots(prev => [
          ...prev.filter(slot => !slotsToRemove.has(slot.id)),
          ...newSlots,
        ]);
      } else {
        // Add new selection
        const newSlot: TimeSlot = {
          id: `${day}-${startSlotIndex}-${endSlotIndex}-${Date.now()}`,
          start: clickedStart,
          end: clickedEnd,
        };
        setSelectedSlots(prev => [...prev, newSlot]);
      }
    }

    setSelectionState({
      isSelecting: false,
      startSlot: null,
      currentSlot: null,
    });
  }, [selectionState, getDateFromSlot, selectedSlots]);

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

    const startSlotIndex = Math.min(selectionState.startSlot.slotIndex, selectionState.currentSlot.slotIndex);
    const endSlotIndex = Math.max(selectionState.startSlot.slotIndex, selectionState.currentSlot.slotIndex);

    return {
      day: selectionState.startSlot.day,
      startSlotIndex,
      endSlotIndex,
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
