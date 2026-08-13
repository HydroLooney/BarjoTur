import { useQuery } from '@tanstack/react-query';
import type { BudgetComparatif } from '@barjotur/shared';
import { api } from '@/lib/api';

// Budget comparatif (api.budget_comparatif) : une ligne par profil comparé, deux lectures (prudente /
// non prudente) + alertes de plafond. Source de l'intendance budget (C-17).
export function useBudgetComparatif() {
  return useQuery({
    queryKey: ['budget', 'comparatif'],
    queryFn: () => api.get<BudgetComparatif[]>('/budget/comparatif'),
    staleTime: 60_000,
    retry: 0,
  });
}
