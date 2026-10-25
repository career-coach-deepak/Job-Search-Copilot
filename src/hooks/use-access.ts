import { queryOptions, useQuery } from "@tanstack/react-query";
import { getMyAccess, type AccessView } from "@/lib/access.functions";

export const accessQueryOptions = queryOptions({
  queryKey: ["my-access"],
  queryFn: () => getMyAccess(),
  staleTime: 30_000,
});

export function useMyAccess() {
  return useQuery(accessQueryOptions);
}

/** True when the person may not use the Copilot (no record, or not in date). */
export function isBlocked(view: AccessView | undefined) {
  return view === undefined || view.kind !== "record" || view.status !== "active";
}
