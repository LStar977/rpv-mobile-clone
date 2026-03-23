import React from 'react';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';

interface BallotIconProps {
  size?: number;
  color?: string;
  secondaryColor?: string;
}

/**
 * Custom Ballot Icon - Ticket/ballot stub design with checkmark
 * Used for the Ballots feature throughout the app
 */
export function BallotIcon({
  size = 24,
  color = '#EABA58',
  secondaryColor,
}: BallotIconProps) {
  const strokeWidth = size < 20 ? 1.5 : 2;
  const checkColor = secondaryColor || color;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Ballot ticket outline */}
      <Path
        d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Perforated tear line (ticket stub effect) */}
      <Line
        x1="4"
        y1="14"
        x2="6"
        y2="14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="8"
        y1="14"
        x2="10"
        y2="14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="12"
        y1="14"
        x2="14"
        y2="14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="16"
        y1="14"
        x2="18"
        y2="14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="18"
        y1="14"
        x2="20"
        y2="14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Vote checkmark in upper section */}
      <Path
        d="M8.5 9L10.5 11L15.5 7"
        stroke={checkColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ballot text line placeholder (lower section) */}
      <Line
        x1="8"
        y1="17"
        x2="16"
        y2="17"
        stroke={color}
        strokeWidth={strokeWidth * 0.75}
        strokeLinecap="round"
        opacity={0.6}
      />
    </Svg>
  );
}

/**
 * Filled variant of the Ballot Icon
 */
export function BallotIconFilled({
  size = 24,
  color = '#EABA58',
  secondaryColor = '#000',
}: BallotIconProps) {
  const strokeWidth = size < 20 ? 1.5 : 2;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Filled ballot background */}
      <Path
        d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z"
        fill={color}
      />

      {/* Perforated tear line */}
      <Line x1="4" y1="14" x2="6" y2="14" stroke={secondaryColor} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="8" y1="14" x2="10" y2="14" stroke={secondaryColor} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="12" y1="14" x2="14" y2="14" stroke={secondaryColor} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="16" y1="14" x2="18" y2="14" stroke={secondaryColor} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="18" y1="14" x2="20" y2="14" stroke={secondaryColor} strokeWidth={strokeWidth} strokeLinecap="round" />

      {/* Vote checkmark */}
      <Path
        d="M8.5 9L10.5 11L15.5 7"
        stroke={secondaryColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ballot text line */}
      <Line
        x1="8"
        y1="17"
        x2="16"
        y2="17"
        stroke={secondaryColor}
        strokeWidth={strokeWidth * 0.75}
        strokeLinecap="round"
        opacity={0.5}
      />
    </Svg>
  );
}

export default BallotIcon;
