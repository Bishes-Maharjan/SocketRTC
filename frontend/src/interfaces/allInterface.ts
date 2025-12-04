export type Friend = User;

export interface User {
  _id: string;
  fullName: string;
  image: string;
  nativeLanguage: string;
  learningLanguage: string;
  location: string;
  provider: string;
  bio: string;
}

export interface RequestDB {
  _id: string;
  sender: User;
  receiver: User;
  status: Status;
  updatedAt: string;
  isRead: boolean;
}

export enum Status {
  Pending = "pending",
  Accepted = "accepted",
  Rejected = "rejected",
}

export interface Message {
  _id: string;
  sender: string;
  to: string;
  roomId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRoom {
  _id: string;
  members: User;
  messages: Message[];
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatsResponse {
  data: {
    chats: ChatRoom[];
    hasMore: boolean;
  };
}

export interface MessagesResponse {
  data: {
    messages: Message[];
    unreadCount: number;
    hasMore: boolean;
  };
}
