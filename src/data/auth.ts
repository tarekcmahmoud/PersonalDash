export interface AuthUser {
  id: string
  email: string
}

/** Username/password auth. In memory mode the user is always signed in. */
export interface AuthService {
  currentUser(): Promise<AuthUser | null>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  /** Subscribe to sign-in/out; returns an unsubscribe function. */
  onChange(cb: (user: AuthUser | null) => void): () => void
}
