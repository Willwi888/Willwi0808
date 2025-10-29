import React from 'react';
import { ColorPalette } from '../styles/colors';

interface KaraokeLyricProps {
  text: string;
  startTime: number;
  endTime: number;
  currentTime: number;
  isPlaying: boolean;
  colorPalette: ColorPalette;
  style?: React.CSSProperties;
}

const KaraokeLyric: React.FC<KaraokeLyricProps> = ({ text, startTime, endTime, currentTime, isPlaying, colorPalette, style }) => {
  const duration = (endTime - startTime) * 1000;
  // Negative delay makes the animation jump to the correct progress if we start mid-lyric
  const delay = (startTime - currentTime) * 1000;

  const animationStyle: React.CSSProperties = {
    ...style,
    opacity: 0, // Start with opacity 0 for fade-in animation to take effect
    backgroundImage: `linear-gradient(to right, ${colorPalette.highlight} 50%, ${colorPalette.base} 50%)`,
    backgroundSize: '200% 100%',
    backgroundPosition: '100%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    animation: `
      karaoke-highlight ${Math.max(0, duration)}ms linear ${delay}ms forwards,
      karaoke-fade-in 400ms ease-out ${delay}ms forwards
    `,
    animationPlayState: isPlaying ? 'running' : 'paused',
  };

  return (
    <>
      <style>
        {`
          @keyframes karaoke-highlight {
            from { background-position: 100%; }
            to { background-position: 0%; }
          }
          @keyframes karaoke-fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
      <p style={animationStyle} className={`w-full p-2 tracking-wide leading-tight text-center`}>
        {text}
      </p>
    </>
  );
};

export default KaraokeLyric;
