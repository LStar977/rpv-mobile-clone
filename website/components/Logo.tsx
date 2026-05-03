export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 4h14a8 8 0 0 1 4.5 14.6L34 36h-6l-7-15h-7v15H8V4Zm6 5v8h8a4 4 0 0 0 0-8h-8Z"
        fill="#E5B95C"
      />
    </svg>
  );
}
