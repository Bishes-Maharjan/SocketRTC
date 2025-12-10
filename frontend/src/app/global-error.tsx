// app/global-error.tsx
'use client';

export default function GlobalError({
    error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (

      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong! {error.message}</h2>
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
  );
}