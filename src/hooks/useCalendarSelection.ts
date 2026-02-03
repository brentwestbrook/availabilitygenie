import { useState, useCallback } from 'react';
import { TimeSlot, SelectionState, SLOT_DURATION_MINUTES, START_HOUR, SLOTS_PER_HOUR } from '@/types/calendar';
import { addDays, addMinutes, setHours, setMinutes } from 'date-fns';

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

      const newSlot: TimeSlot = {
        id: `${day}-${startSlotIndex}-${endSlotIndex}-${Date.now()}`,
        start: getDateFromSlot(day, startSlotIndex),
        end: addMinutes(getDateFromSlot(day, startSlotIndex), (endSlotIndex - startSlotIndex) * SLOT_DURATION_MINUTES),
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
