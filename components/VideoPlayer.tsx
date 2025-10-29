import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TimedLyric } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import Loader from './Loader';
import KaraokeLyric from './KaraokeLyric';
import { lyricColorPalettes, ColorPalette } from '../styles/colors';

interface VideoPlayerProps {
  timedLyrics: TimedLyric[];
  audioUrl: string;
  imageUrls: string[];
  videoUrl?: string | null;
  songTitle: string;
  artistName: string;
  onBack: () => void;
}

const fontOptions = [
  { name: '現代無襯線', value: 'sans-serif' },
  { name: '經典襯線', value: 'serif' },
  { name: '手寫體', value: 'cursive' },
  { name: '打字機', value: 'monospace' },
];

const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrls, videoUrl, songTitle, artistName, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exportProgress, setExportProgress] = useState<{ message: string; progress?: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [currentColorPalette, setCurrentColorPalette] = useState<ColorPalette>(lyricColorPalettes[0]);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('720p');
  const isExportCancelled = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricRefs = useRef<(HTMLDivElement | null)[]>([]);

  const lyricsToRender = useMemo(() => {
    if (!timedLyrics || timedLyrics.length === 0) return [];
    const firstStartTime = timedLyrics[0].startTime ?? 0;
    return [
      { text: '', startTime: -2, endTime: -1 }, 
      { text: '', startTime: -1, endTime: firstStartTime },
      ...timedLyrics,
      { text: '', startTime: 99999, endTime: 999999 },
      { text: '', startTime: 999999, endTime: 9999999 },
    ];
  }, [timedLyrics]);

  const [bgIndex, setBgIndex] = useState(0);
  const durationValue = audioRef.current?.duration || 1;
  const imageSwitchInterval = durationValue / (imageUrls.length || 1);

  useEffect(() => {
      if (!videoUrl && imageUrls.length > 1 && isPlaying) {
          const newIndex = Math.min(Math.floor(currentTime / imageSwitchInterval), imageUrls.length - 1);
          if (newIndex !== bgIndex) {
              setBgIndex(newIndex);
          }
      }
  }, [currentTime, isPlaying, imageSwitchInterval, imageUrls.length, bgIndex, videoUrl]);


  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const timeUpdateHandler = () => setCurrentTime(audio.currentTime);
    const endedHandler = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', timeUpdateHandler);
    audio.addEventListener('ended', endedHandler);

    return () => {
      audio.removeEventListener('timeupdate', timeUpdateHandler);
      audio.removeEventListener('ended', endedHandler);
    };
  }, []);
  
  const currentIndex = useMemo(() => {
    if (currentTime === 0 && !isPlaying) return 1;
    const index = timedLyrics.findIndex(lyric => currentTime >= lyric.startTime && currentTime < lyric.endTime);
    if (index !== -1) return index + 2;
    if (timedLyrics.length > 0 && currentTime >= timedLyrics[timedLyrics.length - 1].endTime) return timedLyrics.length + 2;
    let lastPassedIndex = -1;
    for (let i = 0; i < timedLyrics.length; i++) { if (currentTime >= timedLyrics[i].endTime) lastPassedIndex = i; else break; }
    if (lastPassedIndex !== -1) return lastPassedIndex + 3;
    return 1;
  }, [currentTime, timedLyrics, isPlaying]);


  useEffect(() => {
    if (currentIndex !== -1 && lyricsContainerRef.current && lyricRefs.current[currentIndex]) {
        const container = lyricsContainerRef.current;
        const activeLyricElement = lyricRefs.current[currentIndex]!;
        const newTransform = `translateY(${container.offsetHeight / 2 - activeLyricElement.offsetTop - activeLyricElement.offsetHeight / 2}px)`;
        container.style.transform = newTransform;
    }
  }, [currentIndex, fontSize, aspectRatio]);


  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (audioRef.current.currentTime >= audioRef.current.duration) audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return isNaN(minutes) || isNaN(secs) ? '0:00' : `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSrtTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = (seconds % 1).toFixed(3).substring(2);
    return `${h}:${m}:${s},${ms}`;
  };

  const generateSrtContent = () => {
    return timedLyrics.map((lyric, index) => {
        const startTime = formatSrtTime(lyric.startTime);
        const endTime = formatSrtTime(lyric.endTime);
        return `${index + 1}\n${startTime} --> ${endTime}\n${lyric.text}\n`;
    }).join('\n');
  }

  const handleExportSrt = () => {
    const srtContent = generateSrtContent();
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${songTitle} - ${artistName}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCancelExport = () => {
    isExportCancelled.current = true;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    audioRef.current?.pause();
  };

  const handleExportVideo = async () => {
    if (!audioRef.current) return;
    isExportCancelled.current = false;
    if (isPlaying) handlePlayPause();
    
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: "tab" } as any, audio: true });
        mediaStreamRef.current = stream;
        if (stream.getAudioTracks().length === 0) {
            alert("您沒有分享分頁音訊！請重新操作並務必勾選「分享分頁音訊」選項。");
            stream.getTracks().forEach(track => track.stop());
            return;
        }

        setExportProgress({ message: '準備錄製... 請勿離開此分頁或改變視窗大小' });
        
        const MimeType = 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType: MimeType });
        recorderRef.current = recorder;
        const recordedChunks: Blob[] = [];

        recorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunks.push(event.data); };
        stream.getVideoTracks()[0].onended = () => { if (recorder.state === 'recording') recorder.stop(); };

        recorder.onstop = () => {
            if (!isExportCancelled.current && recordedChunks.length > 0) {
                const blob = new Blob(recordedChunks, { type: MimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${songTitle} - ${artistName}.webm`;
                a.click();
                URL.revokeObjectURL(url);
            }
            stream.getTracks().forEach(track => track.stop());
            setExportProgress(null);
            if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
            mediaStreamRef.current = null; recorderRef.current = null;
        };
        
        recorder.start();
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            setCurrentTime(0);
            await audioRef.current.play();
            setIsPlaying(true);
            setExportProgress({ message: '慢工出真味... 時間不是敵人，是湯頭的朋友。阿嬤手刀飛奔中！' });
        }

        audioRef.current.onended = () => {
             if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
             setIsPlaying(false);
             if (audioRef.current) audioRef.current.onended = () => setIsPlaying(false);
        };

    } catch (error) {
        console.error("Video export failed:", error);
        alert('影片匯出失敗！您可能已取消畫面分享，或您的瀏覽器不支援此功能。');
        setExportProgress(null);
    }
  };
    
  const getLyricStyle = (index: number) => {
    const isActiveIndexDummy = currentIndex < 2 || currentIndex > timedLyrics.length + 1;
    const style: React.CSSProperties = {
        transition: 'transform 0.5s ease-out, opacity 0.5s ease-out, font-size 0.5s ease-out, color 0.5s ease-out',
        fontFamily: fontFamily, fontWeight: 500,
        textShadow: '2px 2px 5px rgba(0,0,0,0.5)', color: '#D1D5DB',
    };

    let calculatedFontSize: number;
    if (index === currentIndex) {
        calculatedFontSize = fontSize;
        style.opacity = isActiveIndexDummy ? 0 : 1;
        style.transform = 'scale(1)';
        style.color = '#FFFFFF';
        style.fontWeight = 700;
    } else if (!isActiveIndexDummy && (index === currentIndex - 1 || index === currentIndex + 1)) {
        calculatedFontSize = fontSize * 0.7;
        style.opacity = 0.6;
        style.transform = 'scale(0.9)';
    } else {
        calculatedFontSize = fontSize * 0.6;
        style.opacity = 0;
        style.transform = 'scale(0.8)';
    }
    style.fontSize = `${calculatedFontSize}px`;
    return style;
  }
  
  const aspectRatioClass = { '16:9': 'aspect-video', '9:16': 'aspect-[9/16] max-h-[70vh] mx-auto', '1:1': 'aspect-square max-h-[70vh] mx-auto' }[aspectRatio];
  const previewLayoutClass = { '16:9': 'flex-row p-4 sm:p-8', '9:16': 'flex-col p-4 sm:p-6', '1:1': 'flex-col p-4 sm:p-6' }[aspectRatio];
  const lyricsContainerClass = { '16:9': 'w-3/5 h-full', '9:16': 'w-full h-1/2 order-2', '1:1': 'w-full h-1/2 order-2' }[aspectRatio];
  const albumContainerClass = { '16:9': 'w-2/5 h-full pl-4', '9:16': 'w-full h-1/2 order-1 items-center justify-end pb-4', '1:1': 'w-full h-1/2 order-1 items-center justify-end pb-4' }[aspectRatio];

  return (
    <>
      {exportProgress && <Loader message={exportProgress.message} onCancel={handleCancelExport} />}
      <div className="w-full max-w-5xl mx-auto">
        <audio ref={audioRef} src={audioUrl} onLoadedMetadata={() => setCurrentTime(0)} />
        
        <div className={`w-full ${aspectRatioClass} bg-gray-900 rounded-xl shadow-2xl ring-1 ring-white/10 relative overflow-hidden mb-4 transition-all duration-300`}>
           {videoUrl ? (
             <video src={videoUrl} autoPlay loop muted className="absolute inset-0 w-full h-full object-cover" />
           ) : (
             imageUrls.map((url, index) => (
               <div key={index} className="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-[1500ms] ease-in-out" style={{ backgroundImage: `url(${url})`, opacity: index === bgIndex ? 1 : 0 }}/>
             ))
           )}
          <div className="absolute inset-0 bg-black/40 filter blur-xl scale-110" style={{ backgroundImage: `url(${videoUrl || imageUrls[bgIndex]})`, backgroundSize: 'cover', backgroundPosition: 'center' }}/>
          <div className="absolute inset-0 bg-black/50" />

           <div className={`relative z-10 w-full h-full flex items-center ${previewLayoutClass}`}>
              <div className={`flex flex-col justify-center items-start overflow-hidden ${lyricsContainerClass}`}>
                <div ref={lyricsContainerRef} className="w-full transition-transform duration-500 ease-in-out">
                    {lyricsToRender.map((lyric, index) => {
                        const isCurrent = index === currentIndex;
                        const isDummy = lyric.startTime < 0 || lyric.startTime > 9999;
                        return (
                            <div key={index} ref={el => { lyricRefs.current[index] = el; }}>
                                {isCurrent && !isDummy ? (
                                    <KaraokeLyric
                                        text={lyric.text}
                                        startTime={lyric.startTime}
                                        endTime={lyric.endTime}
                                        currentTime={currentTime}
                                        isPlaying={isPlaying}
                                        colorPalette={currentColorPalette}
                                        style={getLyricStyle(index)}
                                    />
                                ) : (
                                    <p className={`w-full p-2 tracking-wide leading-tight ${aspectRatio !== '16:9' ? 'text-center' : ''}`} style={getLyricStyle(index)}>
                                        {lyric.text || '\u00A0'}
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>
              </div>

              <div className={`flex flex-col justify-center ${albumContainerClass}`}>
                <img src={imageUrls[0]} alt="專輯封面" className="w-full max-w-[250px] aspect-square object-cover rounded-xl shadow-xl ring-1 ring-white/10" />
                <div className="text-center mt-4 p-2 text-white w-full max-w-[250px]"><p className="font-bold text-lg truncate" title={songTitle}>{songTitle}</p><p className="text-gray-300 truncate" title={artistName}>{artistName}</p></div>
              </div>
            </div>
        </div>

        <div className="p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700">
          <div className="w-full flex items-center gap-4">
            <span className="text-white text-sm font-mono">{formatTime(currentTime)}</span>
            <input type="range" min="0" max={durationValue} value={currentTime} onChange={handleTimelineChange} className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#a6a6a6]" />
            <span className="text-white text-sm font-mono">{formatTime(durationValue)}</span>
          </div>
          <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
              <button onClick={onBack} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm sm:text-base"><PrevIcon className="w-6 h-6" />返回</button>
              <button onClick={handlePlayPause} className="bg-white text-gray-900 rounded-full p-3 transform hover:scale-110 transition-transform">{isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}</button>
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
                <div className="flex items-center gap-2 text-white"><label htmlFor="font-size" className="text-xs">大小</label><input id="font-size" type="range" min="24" max="80" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-20 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-[#a6a6a6]" /></div>
                <div className="flex items-center gap-2 text-white"><label htmlFor="font-family" className="text-xs">字體</label><select id="font-family" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-500">{fontOptions.map(opt => <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>{opt.name}</option>)}</select></div>
                 <div className="flex items-center gap-2 text-white"><label htmlFor="aspect-ratio" className="text-xs">比例</label><select id="aspect-ratio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-500"><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option></select></div>
                <div className="flex items-center gap-2 text-white"><label className="text-xs">色彩</label><div className="flex items-center gap-1.5">{lyricColorPalettes.map(palette => (<button key={palette.name} title={palette.name} onClick={() => setCurrentColorPalette(palette)} className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${currentColorPalette.name === palette.name ? 'border-white' : 'border-transparent'}`} style={{ background: palette.bg }}/>))}</div></div>
                <button onClick={handleExportSrt} className="px-3 py-2 text-sm bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition">導出 SRT</button>
                <button onClick={handleExportVideo} className="px-3 py-2 text-sm bg-[#a6a6a6] text-gray-900 font-semibold rounded-lg hover:bg-[#999999] border border-white/50 transition">導出影片</button>
              </div>
          </div>
          <div className="mt-3 text-center"><p className="text-xs text-gray-500">慢工出真味，時間不是敵人，是湯頭的朋友。影片匯出時請確保勾選「分享分頁音訊」並停留在本頁，阿嬤會在旁為您加油！</p></div>
        </div>
      </div>
    </>
  );
};

export default VideoPlayer;
