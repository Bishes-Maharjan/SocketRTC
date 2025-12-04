import { ChatRoom } from "@/interfaces/allInterface";
import { formatMessageTime, getImage } from "@/lib/utils";
import Image from "next/image";
export function ChatRoomCard({
  chat,
  us,
  isSelected,
  onClick,
}: {
  chat: ChatRoom;
  us: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const lastMessage = chat.messages[0];

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-base-300 cursor-pointer transition-colors hover:bg-base-200 ${
        isSelected ? "bg-base-200" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
          {chat.members.image ? (
            <Image
              src={getImage(chat.members.provider, chat.members.image)}
              alt={chat.members.fullName}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-primary flex items-center justify-center text-primary-content font-semibold text-lg">
              {chat.members.fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-base-content truncate">
              {chat.members.fullName}
            </h3>
            {lastMessage && (
              <span className="text-xs text-base-content/60 ml-2 flex-shrink-0">
                {formatMessageTime(lastMessage.createdAt)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            {lastMessage && (
              <p
                className={`text-sm truncate ${
                  lastMessage.isRead || lastMessage.sender == us
                    ? "text-base-content/60"
                    : "text-base-content font-semibold"
                }`}
              >
                {lastMessage.sender == us
                  ? "You: "
                  : `${chat.members.fullName}: `}
                {lastMessage.message}
              </p>
            )}

            {chat.unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-primary-content bg-primary rounded-full flex-shrink-0">
                {chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
