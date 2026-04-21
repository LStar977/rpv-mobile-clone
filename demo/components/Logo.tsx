export function Logo({ size = 36 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Represent"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}
