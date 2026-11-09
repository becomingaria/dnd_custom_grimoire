import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminApi, type InviteUserInput, type UserRole } from "@/api/admin"
import { useAuth } from "@/context/AuthContext"

const ADMIN_USERS_KEY = ["admin", "users"] as const

export function useAdminUsers() {
    const { isAdmin } = useAuth()
    return useQuery({
        queryKey: ADMIN_USERS_KEY,
        queryFn: () => adminApi.listUsers(),
        select: (res) => res.users,
        enabled: isAdmin,
        staleTime: 1000 * 30,
    })
}

function useInvalidatingMutation<TArgs, TResult>(
    fn: (args: TArgs) => Promise<TResult>,
) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: fn,
        onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY }),
    })
}

export function useInviteUser() {
    return useInvalidatingMutation((input: InviteUserInput) =>
        adminApi.inviteUser(input),
    )
}

export function useUpdateUser() {
    return useInvalidatingMutation(
        ({
            username,
            ...changes
        }: {
            username: string
            role?: UserRole
            enabled?: boolean
        }) => adminApi.updateUser(username, changes),
    )
}

export function useDeleteUser() {
    return useInvalidatingMutation((username: string) =>
        adminApi.deleteUser(username),
    )
}
