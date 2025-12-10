// app/global-error.tsx
'use client';

export default function GlobalError({
  reset,
}: {
  reset: () => void;
}) {
  return (

      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong!</h2>
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
  );
}