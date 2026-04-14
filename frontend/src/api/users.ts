import { apiClient } from "./client"

export interface SetUsernameResponse {
    displayName: string | null
}

export async function setUsername(
    username: string,
    oldUsername?: string,
): Promise<SetUsernameResponse> {
    return apiClient.put<SetUsernameResponse>("/users/username", {
        username,
        oldUsername: oldUsername ?? "",
    })
}
