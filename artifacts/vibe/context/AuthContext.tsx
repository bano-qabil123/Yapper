import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, Profile } from "@/lib/supabase";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    console.log("[Auth] Fetching profile for", userId);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      console.warn("[Auth] Profile fetch error:", error.message);
    } else if (data) {
      console.log("[Auth] Profile loaded:", data.username);
      setProfile(data as Profile);
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  useEffect(() => {
    let initialCheckDone = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log("[Auth] onAuthStateChange event:", _event, "session:", !!newSession);
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
      if (!initialCheckDone) {
        initialCheckDone = true;
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existingSession }, error }) => {
      if (error) {
        console.warn("[Auth] getSession error:", error.message);
      } else {
        console.log("[Auth] getSession result:", existingSession ? "has session" : "no session");
      }
      if (!initialCheckDone) {
        initialCheckDone = true;
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        if (existingSession?.user) {
          fetchProfile(existingSession.user.id).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      }
    }).catch((err) => {
      console.error("[Auth] getSession threw:", err);
      if (!initialCheckDone) {
        initialCheckDone = true;
        setLoading(false);
      }
    });

    const timeout = setTimeout(() => {
      if (!initialCheckDone) {
        console.warn("[Auth] Session check timed out — forcing loading=false");
        initialCheckDone = true;
        setLoading(false);
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signOut = async () => {
    console.log("[Auth] Signing out");
    setSession(null);
    setUser(null);
    setProfile(null);
    const { error } = await supabase.auth.signOut();
    if (error) console.warn("[Auth] Sign out error:", error.message);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
