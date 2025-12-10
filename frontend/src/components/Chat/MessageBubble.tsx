import { Message } from "@/interfaces/allInterface";
import { translateMessage } from "@/lib/apis/chat.api";
import { formatMessageTime } from "@/lib/utils";
import { Languages } from "lucide-react";
import { useEffect, useState } from "react";

export function MessageBubble({
  message,
  isOwn,
  preferredLanguage,
}: {
  message: Message;
  isOwn: boolean;
  preferredLanguage?: string;
}) {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);

  // Reset to default when "No translation" is selected
  useEffect(() => {
    if (!preferredLanguage || preferredLanguage === "") {
      setTranslatedText(null);
      setShowOriginal(true);
      setIsTranslating(false);
    }
  }, [preferredLanguage]);

  const handleTranslate = async () => {
    if (preferredLanguage == "" || !preferredLanguage) 
     { 
        setShowOriginal(true);
        setTranslatedText(message.message);
        setIsTranslating(false);
        return;
     }

    // If already translated, toggle between original and translated
    if (translatedText) {
      setShowOriginal(!showOriginal);
      return;
    }

    setIsTranslating(true);
    try {
      const result = await translateMessage(message.message, preferredLanguage || 'en');
      setTranslatedText(result.translatedText);
      setShowOriginal(false);
    } catch (error) {
      console.error("Translation failed:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className={`flex mb-4 ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isOwn
            ? "bg-primary text-primary-content rounded-br-none"
            : "bg-base-100 text-base-content rounded-bl-none shadow-sm border border-base-300"
        }`}
      >
        <p className="break-words">
          {showOriginal ? message.message : translatedText}
        </p>
        
        {/* Translated label */}
        {!showOriginal && translatedText && (
          <span className={`text-xs italic ${isOwn ? "text-primary-content/60" : "text-base-content/40"}`}>
            (Translated to {preferredLanguage})
          </span>
        )}
        
        <div className="flex items-center justify-between mt-1 gap-2">
          <span
            className={`text-xs ${
              isOwn ? "text-primary-content/70" : "text-base-content/60"
            }`}
          >
            {formatMessageTime(message.createdAt)}
          </span>
          
          {/* Translate button */}
          {preferredLanguage && (
            <button
              onClick={handleTranslate}
              disabled={isTranslating}
              className={`flex items-center gap-1 text-xs hover:opacity-80 transition-opacity ${
                isOwn ? "text-primary-content/70" : "text-base-content/50"
              } ${isTranslating ? "opacity-50" : ""}`}
              title={showOriginal ? `Translate to ${preferredLanguage}` : "Show original"}
            >
              <Languages className="size-3" />
              <span>
                {isTranslating 
                  ? "..." 
                  : translatedText 
                    ? (showOriginal ? "Translate" : "Original")
                    : "Translate"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}