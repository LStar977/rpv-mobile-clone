import React from 'react';

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Represent"
    >
      <circle cx="50" cy="50" r="46" stroke="#EABA58" strokeWidth="4" fill="#040707" />
      {/* Back hand (gold) */}
      <path
        d="M38 32 C38 29, 42 29, 42 32 L42 48 L44 48 L44 24 C44 21, 48 21, 48 24 L48 48 L50 48 L50 22 C50 19, 54 19, 54 22 L54 48 L56 48 L56 28 C56 25, 60 25, 60 28 L60 55 C60 66, 53 72, 46 72 L44 72 C37 72, 32 67, 32 58 L32 44 C32 41, 36 41, 36 44 L36 52 L38 52 Z"
        fill="#EABA58"
      />
      {/* Front hand (white) */}
      <path
        d="M48 46 C48 43, 52 43, 52 46 L52 58 L54 58 L54 40 C54 37, 58 37, 58 40 L58 58 L60 58 L60 38 C60 35, 64 35, 64 38 L64 58 L66 58 L66 44 C66 41, 70 41, 70 44 L70 62 C70 72, 64 78, 58 78 L56 78 C50 78, 46 74, 46 66 L46 54 C46 51, 50 51, 50 54 L50 58 L48 58 Z"
        fill="#F4F5F6"
      />
    </svg>
  );
}
