import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { patreonApi, type PatreonStatus, type PatreonUpdate } from "@/api/admin"
import { useAuth } from "@/context/AuthContext"

const PATREON_KEY = ["admin", "patreon"] as const

export function usePatreonStatus() {
    const { isAdmin } = useAuth()
    return useQuery({
        queryKey: PATREON_KEY,
        queryFn: () => patreonApi.status(),
        enabled: isAdmin,
        staleTime: 1000 * 30,
    })
}

/** Every Patreon mutation returns the new status; also refresh Members. */
function usePatreonMutation<TArgs>(fn: (args: TArgs) => Promise<PatreonStatus>) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: fn,
        onSuccess: (status) => {
            qc.setQueryData(PATREON_KEY, status)
            qc.invalidateQueries({ queryKey: ["admin", "users"] })
        },
    })
}

export const useUpdatePatreon = () =>
    usePatreonMutation((changes: PatreonUpdate) => patreonApi.update(changes))
export const useSyncPatreon = () => usePatreonMutation(() => patreonApi.sync())
export const useDisconnectPatreon = () =>
    usePatreonMutation(() => patreonApi.disconnect())
