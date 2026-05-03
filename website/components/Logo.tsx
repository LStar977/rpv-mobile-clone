import Image from "next/image";

export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Represent Vote"
      width={size}
      height={size}
      priority
      className="rounded-full"
    />
  );
}
