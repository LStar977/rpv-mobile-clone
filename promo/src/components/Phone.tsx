import React from 'react';
import { C } from '../theme';

/** iPhone-proportioned device frame. Screen is a plain obsidian canvas for scene content. */
export const Phone: React.FC<{
  children: React.ReactNode;
  width?: number;
  style?: React.CSSProperties;
}> = ({ children, width = 560, style }) => {
  const height = width * 2.11;
  const radius = width * 0.115;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        padding: width * 0.018,
        background: 'linear-gradient(160deg, rgba(234,186,88,0.35) 0%, rgba(244,245,246,0.08) 34%, rgba(0,0,0,0.6) 100%)',
        boxShadow: '0 60px 140px rgba(0,0,0,0.75), 0 0 90px rgba(234,186,88,0.06)',
        position: 'relative',
        ...style,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: radius - width * 0.018,
          background: C.bg,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* dynamic island */}
        <div
          style={{
            position: 'absolute',
            top: width * 0.038,
            left: '50%',
            transform: 'translateX(-50%)',
            width: width * 0.26,
            height: width * 0.072,
            borderRadius: 999,
            background: '#000',
            zIndex: 20,
          }}
        />
        {children}
      </div>
    </div>
  );
};

/** The app's four-tab bar, pinned to the bottom of the screen. */
export const TabBar: React.FC<{ active?: string }> = ({ active = 'VOTE' }) => {
  const tabs = ['VOTE', 'RESULTS', 'GROUPS', 'YOU'];
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: 30,
        paddingTop: 20,
        display: 'flex',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        borderTop: `1px solid ${C.border}`,
        background: 'rgba(10,13,13,0.9)',
      }}
    >
      {tabs.map((t) => {
        const on = t === active;
        return (
          <div
            key={t}
            style={{
              padding: on ? '10px 20px' : '10px 8px',
              borderRadius: 999,
              background: on ? C.goldSurfaceStrong : 'transparent',
              border: on ? '1px solid rgba(234,186,88,0.35)' : '1px solid transparent',
              fontFamily: 'JetBrainsMono',
              fontSize: 13,
              letterSpacing: 2,
              color: on ? C.gold : C.textDim,
            }}
          >
            {t}
          </div>
        );
      })}
    </div>
  );
};

/** Status bar strip so the screen reads as a real device. */
export const StatusBar: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: `${20 * scale}px ${30 * scale}px 0`,
      fontFamily: 'Onest',
      fontWeight: 600,
      fontSize: 17 * scale,
      color: C.text,
      opacity: 0.85,
    }}
  >
    <span>9:41</span>
    <span style={{ letterSpacing: 2 }}>▮▮▮ ▮</span>
  </div>
);
