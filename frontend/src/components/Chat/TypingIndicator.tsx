export function TypingIndicator({

  containerClassName = "",
  dotClassName = "",
}: {
  label?: string;
  containerClassName?: string;
  dotClassName?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1 text-sm text-base-content/60 italic ${containerClassName}`}
    >
      <div className="flex gap-1 text-base-content/60">
        <span className={`typing-dot ${dotClassName}`} />
        <span className={`typing-dot ${dotClassName}`} />
        <span className={`typing-dot ${dotClassName}`} />
      </div>
      <style jsx>{`
        .typing-dot {
          width: 0.35rem;
          height: 0.35rem;
          background-color: currentColor;
          border-radius: 9999px;
          animation: typing-bounce 1s infinite;
        }

        .typing-dot:nth-child(2) {
          animation-delay: 0.15s;
        }

        .typing-dot:nth-child(3) {
          animation-delay: 0.3s;
        }

        @keyframes typing-bounce {
          0%,
          80%,
          100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  );
}

