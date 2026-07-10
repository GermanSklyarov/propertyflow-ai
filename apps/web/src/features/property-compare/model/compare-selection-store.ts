"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const maxComparableProperties = 3;

type CompareSelectionState = {
  selectedPropertyIds: string[];
  clearSelection: () => void;
  isSelected: (propertyId: string) => boolean;
  toggleProperty: (propertyId: string) => void;
};

export const useCompareSelectionStore = create<CompareSelectionState>()(
  persist(
    (set, get) => ({
      selectedPropertyIds: [],
      clearSelection: () => set({ selectedPropertyIds: [] }),
      isSelected: (propertyId) => get().selectedPropertyIds.includes(propertyId),
      toggleProperty: (propertyId) =>
        set((state) => {
          if (state.selectedPropertyIds.includes(propertyId)) {
            return {
              selectedPropertyIds: state.selectedPropertyIds.filter((selectedPropertyId) => selectedPropertyId !== propertyId)
            };
          }

          return {
            selectedPropertyIds: [...state.selectedPropertyIds, propertyId].slice(-maxComparableProperties)
          };
        })
    }),
    {
      name: "propertyflow-compare-selection",
      partialize: (state) => ({ selectedPropertyIds: state.selectedPropertyIds }),
      storage: createJSONStorage(() => localStorage)
    }
  )
);
