import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react"
import {
    signIn,
    confirmSignIn,
    signOut,
    getCurrentUser,
    fetchAuthSession,
    type AuthUser,
} from "aws-amplify/auth"
import { setUsername } from "@/api/users"

export type UserRole = "admin" | "user"

/** What the login form should show after a sign-in attempt. */
export type LoginResult =
    | { status: "signed-in" }
    /** Invited users must replace their temporary password on first sign-in. */
    | { status: "new-password-required" }

interface AuthContextValue {
    user: AuthUser | null
    userId: string | null
    email: string | null
    displayName: string | null
    role: UserRole | null
    isAdmin: boolean
    isLoading: boolean
    isAuthenticated: boolean
    login: (email: string, password: string) => Promise<LoginResult>
    completeNewPassword: (newPassword: string) => Promise<void>
    logout: () => Promise<void>
    updateDisplayName: (name: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [email, setEmail] = useState<string | null>(null)
    const [displayName, setDisplayName] = useState<string | null>(null)
    const [role, setRole] = useState<UserRole | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const loadUser = useCallback(async () => {
        try {
            const currentUser = await getCurrentUser()
            const session = await fetchAuthSession()
            const sub = session.tokens?.idToken?.payload?.sub as
                | string
                | undefined
            const emailClaim = session.tokens?.idToken?.payload?.email as
                | string
                | undefined
            const nameClaim = session.tokens?.idToken?.payload?.name as
                | string
                | undefined
            const groups = session.tokens?.idToken?.payload?.[
                "cognito:groups"
            ] as string[] | undefined
            const resolvedRole: UserRole = groups?.includes("Admin")
                ? "admin"
                : "user"
            setUser(currentUser)
            setUserId(sub ?? null)
            setEmail(emailClaim ?? currentUser.username ?? null)
            setDisplayName(nameClaim ?? null)
            setRole(resolvedRole)
        } catch {
            setUser(null)
            setUserId(null)
            setRole(null)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadUser()
    }, [loadUser])

    const login = async (
        email: string,
        password: string,
    ): Promise<LoginResult> => {
        const { isSignedIn, nextStep } = await signIn({
            username: email,
            password,
        })
        if (
            !isSignedIn &&
            nextStep.signInStep ===
                "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
        ) {
            return { status: "new-password-required" }
        }
        if (!isSignedIn) {
            throw new Error(
                `Sign-in needs an extra step this app doesn't support yet (${nextStep.signInStep}).`,
            )
        }
        await loadUser()
        return { status: "signed-in" }
    }

    const completeNewPassword = async (newPassword: string) => {
        const { isSignedIn, nextStep } = await confirmSignIn({
            challengeResponse: newPassword,
        })
        if (!isSignedIn) {
            throw new Error(
                `Sign-in needs an extra step this app doesn't support yet (${nextStep.signInStep}).`,
            )
        }
        await loadUser()
    }

    const logout = async () => {
        await signOut()
        setUser(null)
        setUserId(null)
        setEmail(null)
        setDisplayName(null)
        setRole(null)
    }

    const updateDisplayName = async (name: string) => {
        const result = await setUsername(name.trim(), displayName ?? undefined)
        setDisplayName(result.displayName)
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                userId,
                email,
                displayName,
                role,
                isAdmin: role === "admin",
                isLoading,
                isAuthenticated: !!user,
                login,
                completeNewPassword,
                logout,
                updateDisplayName,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error("useAuth must be used within <AuthProvider>")
    return ctx
}
