import { format, isToday, isYesterday } from "date-fns";

export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);

  if (isToday(date)) {
    return `Today, ${format(date, "hh:mm a")}`;
  }

  if (isYesterday(date)) {
    return `Yesterday, ${format(date, "hh:mm a")}`;
  }

  // Older than yesterday
  return format(date, "do MMM");
}

export const capitialize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);
