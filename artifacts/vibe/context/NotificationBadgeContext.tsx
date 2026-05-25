import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";

type NotificationBadgeContextType = {
  unreadCount: number;
  dmUnreadCount: number;
  refresh: () => Promise<void>;
  refreshDm: () => Promise<void>;
  markAllRead: () => void;
};

const NotificationBadgeContext = createContext<NotificationBadgeContextType>({
  unreadCount: 0,
  dmUnreadCount: 0,
  refresh: async () => {},
  refreshDm: async () => {},
  markAllRead: () => {},
});

export function NotificationBadgeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) { setUnreadCount(0); return; }
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setUnreadCount(count ?? 0);
  }, [user]);

  const refreshDm = useCallback(async () => {
    if (!user) { setDmUnreadCount(0); return; }
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("read", false);
    setDmUnreadCount(count ?? 0);
  }, [user]);

  const markAllRead = useCallback(() => setUnreadCount(0), []);

  useEffect(() => {
    refresh();
    refreshDm();
    const interval = setInterval(() => { refresh(); refreshDm(); }, 30000);
    return () => clearInterval(interval);
  }, [refresh, refreshDm]);

  return (
    <NotificationBadgeContext.Provider value={{ unreadCount, dmUnreadCount, refresh, refreshDm, markAllRead }}>
      {children}
    </NotificationBadgeContext.Provider>
  );
}

export function useNotificationBadge() {
  return useContext(NotificationBadgeContext);
}
