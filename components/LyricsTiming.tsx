import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { TimedLyric } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import ResetIcon from './icons/ResetIcon';

interface LyricsTimingProps {
  lyricsText: string;
  audioUrl: string;
  backgroundImageUrl: string;
  onComplete: (timedLyrics: TimedLyric[]) => void;
  onBack: () => void;
}

const LyricsTiming: React.FC<LyricsTimingProps> = ({ lyricsText, audioUrl, backgroundImageUrl, onComplete, onBack }) => {
  const [editableLyrics, setEditableLyrics] = useState(() => 
    [...lyricsText.split('\n').filter(l => l.trim() !== ''), 'END']
  );
  const [timestamps, setTimestamps] = useState<(number | null)[]>(Array(editableLyrics.length).fill(null));
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [playingLineIndex, setPlayingLineIndex] = useState(-1); // New state for playback highlight
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  // Effect to determine which line is currently playing based on currentTime
  useEffect(() => {
    let foundIndex = -1;
    // Iterate backwards to find the last timestamp that is less than or equal to the current time
    for (let i = timestamps.length - 1; i >= 0; i--) {
        if (timestamps[i] !== null && timestamps[i]! <= currentTime) {
            foundIndex = i;
            break;
        }
    }
    setPlayingLineIndex(foundIndex);
  }, [currentTime, timestamps]);


  const handlePlayPause = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, []);

  const setTimestamp = useCallback((index: number) => {
    if (audioRef.current) {
      const newCurrentTime = audioRef.current.currentTime;
      const newTimestamps = [...timestamps];
      newTimestamps[index] = newCurrentTime;
      setTimestamps(newTimestamps);
      
      if (index < editableLyrics.length - 1) {
        setActiveLineIndex(index + 1);
      }
    }
  }, [audioRef, timestamps, editableLyrics.length]);

  const handleResetTimestamp = useCallback((index: number) => {
    const newTimestamps = [...timestamps];
    newTimestamps[index] = null;
    setTimestamps(newTimestamps);
  }, [timestamps]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.isContentEditable) {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
        return;
      }
      
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveLineIndex(prev => Math.min(editableLyrics.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveLineIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // Allow setting timestamp even when paused for more flexible control.
        setTimestamp(activeLineIndex);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLineIndex, editableLyrics.length, handlePlayPause, setTimestamp]);
  
  useEffect(() => {
    const activeLineElement = document.getElementById(`lyric-line-${activeLineIndex}`);
    activeLineElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeLineIndex]);

  const handleLyricChange = (index: number, newText: string) => {
    const newLyrics = [...editableLyrics];
    newLyrics[index] = newText;
    setEditableLyrics(newLyrics);
  };

  const handleComplete = () => {
    if (timestamps.some(t => t === null)) {
      alert('請為所有歌詞行與結尾的 "END" 標記設定時間！');
      return;
    }

    const timedLyrics: TimedLyric[] = timestamps.map((startTime, index) => {
      let nextStartTime : number | null = null;
      for (let i = index + 1; i < timestamps.length; i++) {
        if (timestamps[i] !== null) {
          nextStartTime = timestamps[i];
          break;
        }
      }
      return {
        text: editableLyrics[index],
        startTime: startTime!,
        endTime: nextStartTime || audioRef.current?.duration || startTime! + 5,
      };
    }).filter(lyric => lyric.text !== 'END');
    onComplete(timedLyrics);
  };
  
  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    }
  };

  const handleMetadataLoaded = () => {
      if (audioRef.current) {
          setDuration(audioRef.current.duration);
      }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return isNaN(minutes) || isNaN(secs) ? '0:00' : `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const isCompleteEnabled = useMemo(() => timestamps.every(t => t !== null), [timestamps]);

  return (
    <div className="w-full max-w-7xl mx-auto h-[85vh] flex flex-col">
      <div className="flex-grow flex flex-col lg:flex-row gap-8 items-start overflow-hidden">
        {/* Left Column: Album Art & Hotkeys */}
        <div className="w-full lg:w-1/3 flex-shrink-0 lg:sticky lg:top-0">
          <h3 className="text-xl font-bold text-gray-300 mb-4 text-center">專輯封面</h3>
          <img src={backgroundImageUrl} alt="專輯封面" className="w-full aspect-square object-cover rounded-lg shadow-2xl ring-1 ring-white/10 filter blur-sm" />
          <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
             <h4 className="font-semibold text-gray-300 mb-2">快捷鍵</h4>
             <div className="text-sm text-left grid grid-cols-2 gap-x-4 gap-y-2 text-gray-300">
                <div className="font-mono"><kbd className="font-sans px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">↑</kbd> / <kbd className="font-sans px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">↓</kbd></div>
                <div className="text-gray-400">選擇上/下一句</div>
                <div className="font-mono"><kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Enter</kbd></div>
                <div className="text-gray-400">設定時間戳</div>
                <div className="font-mono"><kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">空格鍵</kbd></div>
                <div className="text-gray-400">播放 / 暫停</div>
              </div>
          </div>
        </div>

        {/* Right Column: Lyrics Table */}
        <div className="w-full lg:w-2/3 h-full overflow-y-auto custom-scrollbar bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700">
          <table className="w-full text-left text-gray-200">
            <thead className="sticky top-0 bg-gray-800 z-10">
              <tr className="border-b border-gray-600">
                <th colSpan={2} className="p-4 text-center text-gray-300 font-semibold">時間</th>
                <th rowSpan={2} className="p-4 align-bottom text-gray-300 font-semibold">歌詞</th>
              </tr>
              <tr className="border-b border-gray-600">
                <th className="py-2 px-3 text-center font-normal text-sm text-gray-400">開始</th>
                <th className="py-2 px-3 text-center font-normal text-sm text-gray-400">結束</th>
              </tr>
            </thead>
            <tbody>
              {editableLyrics.map((line, index) => {
                let endTime: number | null = null;
                if (timestamps[index] !== null) {
                  let nextStartTime = null;
                  for (let i = index + 1; i < timestamps.length; i++) {
                    if (timestamps[i] !== null) {
                      nextStartTime = timestamps[i];
                      break;
                    }
                  }
                  endTime = nextStartTime ?? duration;
                }

                const isLineActive = activeLineIndex === index;
                const isLinePlaying = playingLineIndex === index;

                let rowClassName = 'border-b border-gray-700/50 transition-colors cursor-pointer';
                if (isLineActive) {
                  rowClassName += ' bg-gray-600/50';
                } else if (isLinePlaying) {
                  rowClassName += ' bg-gray-700/40';
                } else {
                  rowClassName += ' hover:bg-gray-700/30';
                }

                const isEndLine = index === editableLyrics.length - 1 && line === 'END';

                return (
                  <tr 
                    key={index}
                    id={`lyric-line-${index}`}
                    onClick={() => setActiveLineIndex(index)}
                    className={rowClassName}
                  >
                    <td className="p-3 text-center w-28 font-mono">
                      <div className="flex items-center justify-center gap-2">
                        <span>{timestamps[index] !== null ? `${timestamps[index]!.toFixed(2)}s` : '---'}</span>
                        {timestamps[index] !== null && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleResetTimestamp(index); }}
                            title="重設時間"
                            className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full transition-colors"
                          >
                            <ResetIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center w-24 font-mono text-gray-400">
                      {endTime && endTime > 0 ? `${endTime.toFixed(2)}s` : '---'}
                    </td>
                    <td className="p-3 text-lg">
                       {isEndLine ? (
                        <p className="px-2 -mx-2 text-gray-400 italic">{line}</p>
                       ) : (
                        <p 
                          contentEditable={true}
                          suppressContentEditableWarning={true}
                          onBlur={(e) => handleLyricChange(index, e.currentTarget.textContent || '')}
                          className="focus:outline-none focus:bg-gray-600/50 rounded px-2 -mx-2 cursor-text min-h-[1.5rem]"
                        >
                          {line}
                        </p>
                       )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Bottom Controls */}
      <div className="flex-shrink-0 mt-4 bg-gray-800 rounded-lg p-4 space-y-3 border border-gray-700">
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          onPlay={() => setIsPlaying(true)} 
          onPause={() => setIsPlaying(false)}
          onLoadedMetadata={handleMetadataLoaded}
        />
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 font-mono w-12 text-center">{formatTime(currentTime)}</span>
          <input
              type="range"
              min={0}
              max={duration || 0}
              step="0.01"
              value={currentTime}
              onChange={handleTimelineChange}
              className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]"
          />
          <span className="text-sm text-gray-400 font-mono w-12 text-center">{formatTime(duration)}</span>
        </div>
        <div className="flex items-center justify-between">
          <button 
              onClick={onBack} 
              className="px-6 py-2 text-gray-300 font-semibold bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
              返回
          </button>
          <button 
              onClick={handlePlayPause} 
              className="bg-white text-gray-900 rounded-full p-3 transform hover:scale-110 transition-transform"
          >
              {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
          </button>
          <button 
              onClick={handleComplete}
              disabled={!isCompleteEnabled}
              className="px-6 py-2 bg-[#a6a6a6] text-gray-900 font-bold rounded-lg border border-white/50 hover:bg-[#999999] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
              完成並預覽
          </button>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #a6a6a6; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default LyricsTiming;