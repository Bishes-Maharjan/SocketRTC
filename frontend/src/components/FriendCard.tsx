import { LANGUAGE_TO_FLAG } from "@/constants/locations";
import { Friend } from "@/interfaces/allInterface";
import { getChatById } from "@/lib/apis/chat.api";
import { getImage } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";

const FriendCard = ({ friend }: { friend: Friend }) => {
  const { data: chat } = useQuery({
    queryKey: ["partner", friend._id],
    queryFn: () => getChatById(friend._id),
  });
  return (
    <div className="card bg-base-200 hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        {/* USER INFO */}
        <div className="flex items-center gap-3 mb-3">
          <div className="avatar size-12">
            <Image
              fill
              sizes="80px"
              src={getImage( friend.image)}
              alt={friend.fullName}
            />
          </div>
          <h3 className="font-semibold truncate">{friend.fullName}</h3>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="badge badge-secondary text-xs">
            {getLanguageFlag(friend.nativeLanguage)}
            Native: {friend.nativeLanguage}
          </span>
          <span className="badge badge-outline text-xs">
            {getLanguageFlag(friend.learningLanguage)}
            Learning: {friend.learningLanguage}
          </span>
        </div>

        <Link href={`/chat/?chatId=${chat?._id}`} className="btn btn-outline w-full">
          Message
        </Link>
      </div>
    </div>
  );
};
export default FriendCard;

export function getLanguageFlag(language: string) {
  if (!language) return null;

  const langLower = language.toLowerCase() as keyof typeof LANGUAGE_TO_FLAG;
  const countryCode = LANGUAGE_TO_FLAG[langLower];

  if (countryCode) {
    return (
      <Image
        src={`https://flagcdn.com/24x18/${countryCode}.png`}
        alt={`${langLower} flag`}
        className="h-3 mr-1 inline-block"
        width={24}
        height={18}
      />
    );
  }
  return null;
}
