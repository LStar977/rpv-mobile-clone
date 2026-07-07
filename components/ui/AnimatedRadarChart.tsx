import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Polygon, Circle, Line, G, Text as SvgText } from 'react-native-svg';
import { useTheme, FONTS } from '../../lib/theme';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

interface CategoryScore {
  category: string;
  score: number;
}

interface AnimatedRadarChartProps {
  data: CategoryScore[];
  size?: number;
  animate?: boolean;
  showLabels?: boolean;
  fillColor?: string;
  strokeColor?: string;
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return '#34C759';
  if (score >= 65) return '#30D158';
  if (score >= 50) return '#FF9500';
  if (score >= 35) return '#FF6B35';
  return '#FF3B30';
};

export function AnimatedRadarChart({
  data,
  size = 200,
  animate = true,
  showLabels = true,
  fillColor,
  strokeColor,
}: AnimatedRadarChartProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  const center = size / 2;
  const radius = (size / 2) - 40;
  const numPoints = data.length;
  const angleStep = (2 * Math.PI) / numPoints;

  const avgScore = data.reduce((sum, d) => sum + d.score, 0) / data.length;
  const dynamicFillColor = fillColor || `${getScoreColor(avgScore)}40`;
  const dynamicStrokeColor = strokeColor || getScoreColor(avgScore);

  useEffect(() => {
    if (animate) {
      progress.value = 0;
      progress.value = withDelay(
        200,
        withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
      );

      pulseScale.value = withDelay(
        1000,
        withSequence(
          withTiming(1.02, { duration: 600 }),
          withTiming(1, { duration: 600 })
        )
      );
    } else {
      progress.value = 1;
    }
  }, [data, animate]);

  const getPoint = (index: number, value: number): { x: number; y: number } => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const getLabelPosition = (index: number): { x: number; y: number } => {
    const angle = index * angleStep - Math.PI / 2;
    const r = radius + 25;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const animatedProps = useAnimatedProps(() => {
    const points = data
      .map((d, i) => {
        const animatedValue = interpolate(progress.value, [0, 1], [0, d.score]);
        const point = getPoint(i, animatedValue);
        return `${point.x},${point.y}`;
      })
      .join(' ');
    return { points };
  });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const gridLines = [20, 40, 60, 80, 100];

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, containerStyle]}>
      <Svg width={size} height={size}>
        <G>
          {gridLines.map((level) => {
            const gridPoints = Array.from({ length: numPoints }, (_, i) => {
              const point = getPoint(i, level);
              return `${point.x},${point.y}`;
            }).join(' ');

            return (
              <Polygon
                key={`grid-${level}`}
                points={gridPoints}
                fill="none"
                stroke={colors.border}
                strokeWidth={level === 60 ? 1.5 : 0.5}
                strokeDasharray={level === 60 ? undefined : '3,3'}
                opacity={0.4}
              />
            );
          })}

          {data.map((_, i) => {
            const endPoint = getPoint(i, 100);
            return (
              <Line
                key={`axis-${i}`}
                x1={center}
                y1={center}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke={colors.border}
                strokeWidth={0.5}
                opacity={0.3}
              />
            );
          })}

          <AnimatedPolygon
            animatedProps={animatedProps}
            fill={dynamicFillColor}
            stroke={dynamicStrokeColor}
            strokeWidth={2.5}
          />

          {data.map((d, i) => {
            const point = getPoint(i, d.score);
            return (
              <Circle
                key={`point-${i}`}
                cx={point.x}
                cy={point.y}
                r={4}
                fill={dynamicStrokeColor}
                stroke={colors.background}
                strokeWidth={2}
              />
            );
          })}
        </G>

        {showLabels &&
          data.map((d, i) => {
            const pos = getLabelPosition(i);
            const shortLabel = d.category.length > 12
              ? d.category.substring(0, 10) + '...'
              : d.category;

            return (
              <SvgText
                key={`label-${i}`}
                x={pos.x}
                y={pos.y}
                fill={colors.textSecondary}
                fontSize={9}
                fontWeight="500"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {shortLabel}
              </SvgText>
            );
          })}
      </Svg>

      <View style={styles.centerLabel}>
        <Text style={[styles.centerScore, { color: dynamicStrokeColor }]}>
          {Math.round(avgScore)}
        </Text>
        <Text style={[styles.centerText, { color: colors.textTertiary }]}>AVG</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerScore: {
    fontSize: 28,
    fontFamily: FONTS.sansBold,
  },
  centerText: {
    fontSize: 10,
    fontFamily: FONTS.sansSemiBold,
    letterSpacing: 1,
  },
});

export default AnimatedRadarChart;
