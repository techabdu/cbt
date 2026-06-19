export interface AppNotification {
  id: string;
  type: string;
  data: {
    title: string;
    message: string;
    category?: "approved" | "rejected" | "results" | "info";
    link?: string;
  };
  read_at: string | null;
  created_at: string;
}

export interface NotificationFeed {
  unread_count: number;
  notifications: AppNotification[];
}
