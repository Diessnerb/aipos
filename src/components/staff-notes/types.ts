
export interface Channel {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  is_read_only: boolean;
}

export interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  channel_id: string;
  users: {
    full_name: string;
    role: string;
  };
}

export interface User {
  id: string;
  full_name: string;
  role: string;
}
