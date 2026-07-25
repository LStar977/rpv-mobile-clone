import { interpolate, Easing, spring } from 'remotion';

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** Opacity envelope for a scene: fades up over `inLen`, holds, fades out before `total`. */
export const sceneFade = (frame: number, total: number, inLen = 12, outLen = 12) =>
  interpolate(
    frame,
    [0, inLen, total - outLen, total],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

/** Text that rises into place: returns {opacity, transform}. */
export const rise = (frame: number, at: number, distance = 28, len = 22) => {
  const p = interpolate(frame, [at, at + len], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * distance}px)`,
  };
};

/** A line that draws outward from its centre. */
export const draw = (frame: number, at: number, len = 26) =>
  interpolate(frame, [at, at + len], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });

export const springIn = (frame: number, fps: number, at: number, damping = 200) =>
  spring({ frame: frame - at, fps, config: { damping, mass: 0.8, stiffness: 110 } });
