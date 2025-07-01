import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import PostgresAdapter from '@auth/pg-adapter';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // ssl: {
  //   rejectUnauthorized: false,
  // },
  //Removed this bcs my database is local and does not require SSL, uncomment if connecting to a remote db
});

const handler = NextAuth({
  adapter: PostgresAdapter(pool),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt', // 👈 forces usage of JWT instead of DB sessions
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account?.id_token) {
        // This is the ID token you need
        token.idToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.idToken) {
        (session as any).idToken = token.idToken;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
