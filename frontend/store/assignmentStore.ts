import { create } from 'zustand';
import { Assignment } from '@/types';

interface AssignmentState {
  assignments: Assignment[];
  selectedAssignment: Assignment | null;
  isLoading: boolean;
  error: string | null;

  setAssignments: (assignments: Assignment[]) => void;
  addAssignment: (assignment: Assignment) => void;
  updateAssignment: (id: string, updates: Partial<Assignment>) => void;
  removeAssignment: (id: string) => void;
  setSelectedAssignment: (assignment: Assignment | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAssignmentStore = create<AssignmentState>((set) => ({
  assignments: [],
  selectedAssignment: null,
  isLoading: false,
  error: null,

  setAssignments: (assignments) => set({ assignments }),
  addAssignment: (assignment) =>
    set((state) => ({ assignments: [assignment, ...state.assignments] })),
  updateAssignment: (id, updates) =>
    set((state) => ({
      assignments: state.assignments.map((a) =>
        a._id === id ? { ...a, ...updates } : a
      ),
    })),
  removeAssignment: (id) =>
    set((state) => ({
      assignments: state.assignments.filter((a) => a._id !== id),
    })),
  setSelectedAssignment: (assignment) => set({ selectedAssignment: assignment }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
