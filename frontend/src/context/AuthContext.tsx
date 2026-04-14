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
    signOut,
    getCurrentUser,
    fetchAuthSession,
    type AuthUser,
} from "aws-amplify/auth"

interface AuthContextValue {
    user: AuthUser | null
    userId: string | null
    isLoading: boolean
    isAuthenticated: boolean
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const loadUser = useCallback(async () => {
        try {
            const currentUser = await getCurrentUser()
            const session = await fetchAuthSession()
            const sub = session.tokens?.idToken?.payload?.sub as
                | string
                | undefined
            setUser(currentUser)
            setUserId(sub ?? null)
        } catch {
            setUser(null)
            setUserId(null)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadUser()
    }, [loadUser])

    const login = async (email: string, password: string) => {
        await signIn({ username: email, password })
        await loadUser()
    }

    const logout = async () => {
        await signOut()
        setUser(null)
        setUserId(null)
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                userId,
                isLoading,
                isAuthenticated: !!user,
                login,
                logout,
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
