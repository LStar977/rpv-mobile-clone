import { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, G, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  useAnimatedProps,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { makeEquirectangular, geometryToPath, geometryCentroid } from './projection';
import worldData from '../../assets/geo/world-countries-110m.json';

// Activity heuristic note:
// Pulse intensity is keyed to total active votes per country (sum of
// supportVotes + opposeVotes over proposals with future deadlines, grouped
// by country). This is a proxy for real engagement. A backend endpoint that
// returns time-windowed activity (votes_last_24h) is the correct fix and is
// scoped as a Phase 2 follow-up.

const O_BG = '#040707';
const O_LINE = '#1A1F1F';
const O_GOLD = '#EABA58';
const O_GOLD_DIM = 'rgba(234, 186, 88, 0.55)';
const O_LAND = '#1B2329';
const O_LAND_ACTIVE = '#2D3A44';
const O_LAND_BORDER = 'rgba(244, 245, 246, 0.13)';
const O_LAND_BORDER_ACTIVE = 'rgba(234, 186, 88, 0.75)';

// Internal SVG dimensions. The viewBox is fixed at 2:1, world fits exactly.
const MAP_W = 1000;
const MAP_H = 500;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Feature = {
  type: 'Feature';
  properties: { name: string };
  geometry: any;
};

type CountryStat = {
  name: string;
  proposalCount: number;
  totalVotes: number;
};

const project = makeEquirectangular(MAP_W, MAP_H);

// Pre-compute country paths and centroids ONCE at module load.
const COUNTRIES: Array<{
  name: string;
  d: string;
  centroid: [number, number];
}> = (worldData as { features: Feature[] }).features.map((f) => {
  const [lon, lat] = geometryCentroid(f.geometry);
  const [cx, cy] = project(lon, lat);
  return {
    name: f.properties.name,
    d: geometryToPath(f.geometry, project),
    centroid: [cx, cy],
  };
});

// Animated beacon ring expanding outward from an active country.
// Two of these rendered per country at staggered phases produces the
// double-pulse "radio tower" look that makes the planet read as alive.
function BeaconRing({
  cx,
  cy,
  intensity,
  delay,
  maxRadius,
}: {
  cx: number;
  cy: number;
  intensity: number; // 0..1
  delay: number;
  maxRadius: number;
}) {
  // Period: 1.4s for high intensity, 3.0s for low.
  const period = 1400 + (1 - intensity) * 1600;
  const r = useSharedValue(4);
  const opacity = useSharedValue(0.7);

  r.value = withDelay(
    delay,
    withRepeat(
      withTiming(maxRadius, { duration: period, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    ),
  );
  opacity.value = withDelay(
    delay,
    withRepeat(
      withTiming(0, { duration: period, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    ),
  );

  const animatedProps = useAnimatedProps(() => ({
    r: r.value,
    opacity: opacity.value,
  }));

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill="none"
      stroke={O_GOLD}
      strokeWidth={1.5}
      animatedProps={animatedProps}
    />
  );
}

export type WorldMapProps = {
  countryStats: Map<string, CountryStat>;
  onSelectCountry: (countryName: string) => void;
};

export function WorldMap({ countryStats, onSelectCountry }: WorldMapProps) {
  // Pan + pinch state. Start slightly zoomed in (1.4) so the planet feels
  // bigger on first paint — most empty ocean is hidden by default.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1.4);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1.4);

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = startScale.value * e.scale;
      scale.value = Math.min(Math.max(next, 1), 5);
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const transformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  // Compute max votes once for normalizing pulse intensity.
  const maxVotes = useMemo(() => {
    let m = 0;
    countryStats.forEach((s) => {
      if (s.totalVotes > m) m = s.totalVotes;
    });
    return Math.max(m, 1);
  }, [countryStats]);

  const screen = Dimensions.get('window');
  const aspect = MAP_W / MAP_H;
  const renderW = screen.width;
  const renderH = renderW / aspect;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[{ width: renderW, height: renderH }, transformStyle]}>
          <Svg width={renderW} height={renderH} viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
            <Defs>
              <RadialGradient id="oceanGlow" cx="50%" cy="50%" r="60%">
                <Stop offset="0%" stopColor="#0A1014" stopOpacity={1} />
                <Stop offset="100%" stopColor={O_BG} stopOpacity={1} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#oceanGlow)" />

            {/* All countries — static fill + border. Active countries get a
                slightly brighter fill and gold-tinted stroke. */}
            <G>
              {COUNTRIES.map((c) => {
                const stat = countryStats.get(c.name);
                const isActive = !!stat;
                return (
                  <Path
                    key={c.name}
                    d={c.d}
                    fill={isActive ? O_LAND_ACTIVE : O_LAND}
                    stroke={isActive ? O_LAND_BORDER_ACTIVE : O_LAND_BORDER}
                    strokeWidth={isActive ? 0.6 : 0.35}
                    onPress={isActive ? () => onSelectCountry(c.name) : undefined}
                  />
                );
              })}
            </G>

            {/* Static glow halo + center dot for each active country.
                The double-ring beacon animation rides on top. */}
            <G pointerEvents="none">
              {COUNTRIES.filter((c) => countryStats.has(c.name)).map((c, i) => {
                const stat = countryStats.get(c.name)!;
                const intensity = Math.min(stat.totalVotes / maxVotes, 1);
                const maxR = 22 + intensity * 14;
                return (
                  <G key={`beacon-${c.name}`}>
                    {/* Soft halo behind the dot — static, not animated */}
                    <Circle
                      cx={c.centroid[0]}
                      cy={c.centroid[1]}
                      r={9}
                      fill={O_GOLD}
                      opacity={0.18}
                    />
                    <Circle
                      cx={c.centroid[0]}
                      cy={c.centroid[1]}
                      r={5}
                      fill={O_GOLD}
                      opacity={0.4}
                    />
                    {/* Two staggered beacon rings */}
                    <BeaconRing
                      cx={c.centroid[0]}
                      cy={c.centroid[1]}
                      intensity={intensity}
                      delay={(i * 230) % 2200}
                      maxRadius={maxR}
                    />
                    <BeaconRing
                      cx={c.centroid[0]}
                      cy={c.centroid[1]}
                      intensity={intensity}
                      delay={((i * 230) % 2200) + (1400 + (1 - intensity) * 1600) / 2}
                      maxRadius={maxR}
                    />
                    {/* Solid center dot — always crisp */}
                    <Circle
                      cx={c.centroid[0]}
                      cy={c.centroid[1]}
                      r={3}
                      fill={O_GOLD}
                    />
                  </G>
                );
              })}
            </G>
          </Svg>

          {/* Count badges absolutely positioned over the SVG. Using RN Text
              instead of SvgText so they stay crisp at any zoom. */}
          {COUNTRIES.filter((c) => countryStats.has(c.name)).map((c) => {
            const stat = countryStats.get(c.name)!;
            const px = (c.centroid[0] / MAP_W) * renderW;
            const py = (c.centroid[1] / MAP_H) * renderH;
            return (
              <View
                key={`label-${c.name}`}
                pointerEvents="none"
                style={[styles.countBadge, { left: px + 6, top: py - 8 }]}
              >
                <Text style={styles.countBadgeText}>
                  {stat.proposalCount}
                </Text>
              </View>
            );
          })}
        </Animated.View>
      </GestureDetector>

      {/* Hint copy under the map */}
      <Text style={styles.hint}>
        Tap a glowing country to see what's happening
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: O_BG,
    paddingTop: 8,
    overflow: 'hidden',
  },
  countBadge: {
    position: 'absolute',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(4, 7, 7, 0.85)',
    borderWidth: 0.5,
    borderColor: O_GOLD_DIM,
  },
  countBadgeText: {
    color: O_GOLD,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  hint: {
    color: '#7A7D7E',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 12,
    letterSpacing: 0.2,
  },
});
