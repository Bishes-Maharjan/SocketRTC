import { axiosInstance } from "./axios";

//------------------------ User ------------------------
export const getUser = async (id: string) => {
  const res = await axiosInstance.get(`/user/${id}`);

  return res.data;
};

export const getRecommendedUsers = async () => {
  const res = await axiosInstance.get("user/recommendation");
  return res.data;
};

export const getUserFriends = async () => {
  const res = await axiosInstance.get("user/friends");
  return res.data;
};

//------------------------Friend Request------------------------
export const getFriendRequest = async () => {
  const res = await axiosInstance.get("user/friend-request");
  return res.data;
};

export const sendFriendRequest = async (id: string) => {
  const res = await axiosInstance.post(`user/friend-request/${id}/`);
  return res.data;
};

export const acceptFriendRequest = async (id: string) => {
  const res = await axiosInstance.patch(`user/accept/friend-request/${id}`);

  return res.data;
};

export const rejectFriendRequest = async (id: string) => {
  const res = await axiosInstance.delete(`user/reject/friend-request/${id}`);
  return res.data;
};

export const getOutgoingFriendReqs = async () => {
  const res = await axiosInstance.get("user/outgoing-friend-request");
  return res.data;
};

//------------------------Notifcation------------------------
export const getTotalNotificationCount = async () => {
  const res = await axiosInstance.get("user/notification/count");
  return res.data;
};
export const readAllNotification = async () => {
  const res = await axiosInstance.patch("user/notification/read");
  return res.data;
};
