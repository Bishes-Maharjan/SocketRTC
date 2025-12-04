export interface Friend {
  _id: string;
  fullName: string;
  image: string;
  nativeLanguage: string;
  learningLanguage: string;
  location: string;
  bio: string;
}

export interface User {
  _id: string;
  fullName: string;
  image: string;
  nativeLanguage: string;
  learningLanguage: string;
  location: string;
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
