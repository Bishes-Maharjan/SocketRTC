import { axiosInstance } from "./axios";

export class QueryDTO {
  limit: number = 20;
  page: number = 1;
}

export const getAllChats = async (query?: QueryDTO) => {
  const response = await axiosInstance.get(
    `chat?limit=${query?.limit}&page=${query?.page}`
  );
  // Backend returns { chats: [...], hasMore: boolean }
  // Frontend expects { data: { chats: [...], hasMore: boolean } }
  return { data: response.data };
};

export const readMessagesForRoom = async (roomId: string) => {
  const readAll = await axiosInstance.get(`message/read/${roomId}`);
  return readAll.data;
};

export const unReadChatNotification = async () => {
  const count = await axiosInstance.get("message/unread");
  console.log('count', count.data);
  return count.data;
};

export const getRoomMessageWithItsUnreadCount = async (
  roomId: string,
  query?: QueryDTO
) => {
  const response = await axiosInstance.get(
    `message/${roomId}?limit=${query?.limit}&page=${query?.page}`
  );
  // Backend returns { messages: [...], unreadCount: number, hasMore: boolean }
  // Frontend expects { data: { messages: [...], unreadCount: number, hasMore: boolean } }
  return { data: response.data };
};

export const getChatById = async (userId: string) => {
  const res = await axiosInstance.get(`chat/${userId}`);
  console.log('chat', res.data);  
  return res.data;
};
