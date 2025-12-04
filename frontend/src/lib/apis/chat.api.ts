import { axiosInstance } from "./axios";

export class QueryDTO {
  limit: number = 20;
  page: number = 1;
}

export const getAllChats = async (query?: QueryDTO) => {
  const chats = await axiosInstance.get(
    `chat?limit=${query?.limit}&page=${query?.page}`
  );
  //   console.log(chats.data);
  return chats;
};

export const readMessagesForRoom = async (roomId: string) => {
  const readAll = await axiosInstance.get(`message/read/${roomId}`);
  return readAll.data;
};

export const unReadChatNotification = async () => {
  const count = await axiosInstance.get("message/unread");
  return count;
};

export const getRoomMessageWithItsUnreadCount = async (
  roomId: string,
  query?: QueryDTO
) => {
  const messages = await axiosInstance.get(
    `message/${roomId}?limit=${query?.limit}&page=${query?.page}`
  );
  return messages;
};
