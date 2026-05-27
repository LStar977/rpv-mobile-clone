import { motion } from "framer-motion";

/**
 * Fixed full-viewport decorative layer with soft gold and grey radial
 * blur blobs. Subtle, premium, sits behind all content.
 */
export default function Background() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: "#F2F2F0" }}
      aria-hidden
    >
      {/* Gold blob — top left */}
      <motion.div
        className="absolute rounded-full blur-[120px]"
        style={{
          width: "46vw",
          height: "46vw",
          top: "-12vw",
          left: "-8vw",
          background:
            "radial-gradient(circle at center, rgba(234,186,88,0.42), rgba(234,186,88,0) 68%)",
        }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Grey blob — center right */}
      <motion.div
        className="absolute rounded-full blur-[130px]"
        style={{
          width: "52vw",
          height: "52vw",
          top: "18vh",
          right: "-14vw",
          background:
            "radial-gradient(circle at center, rgba(60,64,70,0.20), rgba(60,64,70,0) 70%)",
        }}
        animate={{ x: [0, -50, 0], y: [0, 40, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Gold blob — bottom */}
      <motion.div
        className="absolute rounded-full blur-[140px]"
        style={{
          width: "40vw",
          height: "40vw",
          bottom: "-14vw",
          left: "30vw",
          background:
            "radial-gradient(circle at center, rgba(234,186,88,0.28), rgba(234,186,88,0) 70%)",
        }}
        animate={{ x: [0, 30, 0], y: [0, -30, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Soft grey blob — top right for depth */}
      <div
        className="absolute rounded-full blur-[110px]"
        style={{
          width: "30vw",
          height: "30vw",
          top: "-6vw",
          right: "8vw",
          background:
            "radial-gradient(circle at center, rgba(17,17,17,0.06), rgba(17,17,17,0) 70%)",
        }}
      />

      {/* Fine grain vignette to keep it institutional */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 0%, rgba(242,242,240,0) 60%, rgba(242,242,240,0.6) 100%)",
        }}
      />
    </div>
  );
}
