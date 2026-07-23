import { create } from 'zustand';

import { type Shape } from '@/services/firebase/shapes';

// Mirror of the user's saved-shapes subscription (users/{uid}/shapes).
type ShapesState = {
  shapes: Shape[];
  setShapes: (shapes: Shape[]) => void;
  clear: () => void;
};

export const useShapesStore = create<ShapesState>()(set => ({
  shapes: [],
  setShapes: shapes => set({ shapes }),
  clear: () => set({ shapes: [] }),
}));
