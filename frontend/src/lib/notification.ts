import { axiosInstance } from "./axios";

export const readAllNotifications = async () => {
  const res = await axiosInstance.patch("user/notification/read");
  return res.data;
};

export const getNotificationCount = async () => {
  const res = await axiosInstance.get("user/notification/count");
  return res.data;
};
