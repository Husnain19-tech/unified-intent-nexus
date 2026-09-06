import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspace, type Workspace } from "./omniflow.functions";

export function useWorkspace() {
  const fetchWorkspace = useServerFn(getWorkspace);
  return useQuery<Workspace>({
    queryKey: ["workspace"],
    queryFn: () => fetchWorkspace(),
    staleTime: 10_000,
  });
}
