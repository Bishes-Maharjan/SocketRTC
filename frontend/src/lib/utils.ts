import { format, isToday, isYesterday } from "date-fns";

export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  if (isToday(date)) {
    return format(date, "hh:mm a");
  }

  if (isYesterday(date)) {
    return `Yesterday, ${format(date, "hh:mm a")}`;
  }

  return format(date, "do MMM");
}

export const capitialize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

export const getImage = (image: string | undefined): string => {
  if (!image) return '';

  const img = image.includes('uploads')
    ? `${process.env.NEXT_PUBLIC_API_URL}${image}`
    : image;

  return img;
};
