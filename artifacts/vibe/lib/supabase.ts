import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  verified: boolean;
  created_at: string;
  onboarded?: boolean;
  interests?: string[];
  push_notifications?: boolean;
};

export type Post = {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
  views?: number;
  author?: Profile;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  profiles?: Profile;
  replies?: Comment[];
};

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
};

export type Bookmark = {
  post_id: string;
  user_id: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string;
  type: "follow" | "comment" | "like";
  post_id: string | null;
  read: boolean;
  created_at: string;
  profiles?: Profile;
  posts?: Post;
};

export type Follower = {
  user_id: string;
  target_user_id: string;
};
