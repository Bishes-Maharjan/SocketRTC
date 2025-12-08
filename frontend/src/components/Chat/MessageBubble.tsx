import { Message } from "@/interfaces/allInterface";
import { formatMessageTime } from "@/lib/utils";

export function MessageBubble({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  return (
    <div className={`flex mb-4 ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isOwn
            ? "bg-primary text-primary-content rounded-br-none"
            : "bg-base-100 text-base-content rounded-bl-none shadow-sm border border-base-300"
        }`}
      >
        <p className="break-words">{message.message}</p>
        <span
          className={`text-xs mt-1 block ${
            isOwn ? "text-primary-content/70" : "text-base-content/60"
          }`}
        >
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
