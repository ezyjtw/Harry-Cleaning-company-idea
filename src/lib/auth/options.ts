import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // TODO: Replace with real database lookup
        if (!credentials?.email || !credentials?.password) return null

        // Mock users for development
        const mockUsers = [
          { id: '1', email: 'client@rena.com', password: 'password123', name: 'Sarah Johnson', role: 'CLIENT' },
          { id: '2', email: 'cleaner@rena.com', password: 'password123', name: 'Maria Santos', role: 'CLEANER' },
          { id: '3', email: 'admin@rena.com', password: 'password123', name: 'Admin User', role: 'ADMIN' },
        ]

        const user = mockUsers.find(u => u.email === credentials.email && u.password === credentials.password)
        if (!user) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.role = (user as any).role; token.id = user.id }
      return token
    },
    async session({ session, token }) {
      if (session.user) { (session.user as any).role = token.role; (session.user as any).id = token.id }
      return session
    },
  },
  pages: { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production',
}
