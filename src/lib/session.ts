import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/auth.functions";
import { listDepartments, listEntities } from "@/lib/masters.functions";

export type Department = string;
export type Entity = { id: string; name: string };

export const sessionQueryKey = ["session-profile"] as const;

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: () => listDepartments(),
  });
}

export function useEntities() {
  return useQuery({
    queryKey: ["entities"],
    queryFn: () => listEntities() as Promise<Entity[]>,
  });
}

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => getSession(),
  });
}
