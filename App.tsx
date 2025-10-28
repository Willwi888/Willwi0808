import React, { useState, useCallback, useEffect, useMemo } from 'react';
import LyricsTiming from './components/LyricsTiming';
import VideoPlayer from './components/VideoPlayer';
import MusicIcon from './components/icons/MusicIcon';
import ImageIcon from './components/icons/ImageIcon';
import UploadIcon from './components/icons/UploadIcon';
import LockIcon from './components/icons/LockIcon';
import { TimedLyric } from './types';
import Loader from './components/Loader';
import { parseSrt } from './utils';
import { generateImagesForLyrics } from './services/geminiService';


type AppState = 'FORM' | 'TIMING' | 'PREVIEW';

const DEFAULT_BG_IMAGE = 'https://storage.googleapis.com/aistudio-hosting/workspace-template-assets/lyric-video-maker/default_bg.jpg';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('FORM');
  const [lyricsText, setLyricsText] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [backgroundImages, setBackgroundImages] = useState<(File|string)[]>([]);
  const [timedLyrics, setTimedLyrics] = useState<TimedLyric[]>([]);
  const [timedLyricsFromSrt, setTimedLyricsFromSrt] = useState<TimedLyric[] | null>(null);
  const [isLoading, setIsLoading] = useState<{ active: boolean; message: string }>({ active: false, message: '' });
  const [isAiUnlocked, setIsAiUnlocked] = useState(false);
  const AI_PASSWORD = '8520';

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const audioUrl = audioFile ? URL.createObjectURL(audioFile) : '';
  const backgroundUrls = useMemo(() => {
    if (backgroundImages.length === 0) return [DEFAULT_BG_IMAGE];
    return backgroundImages.map(img => {
        if (typeof img === 'string') return img; // Already a data URL from AI
        return URL.createObjectURL(img);
    });
  }, [backgroundImages]);


  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lyricsText || !audioFile || !songTitle || !artistName) {
      alert('請填寫所有必填欄位！');
      return;
    }
    if (timedLyricsFromSrt) {
        setTimedLyrics(timedLyricsFromSrt);
        setAppState('PREVIEW');
    } else {
      setAppState('TIMING');
    }
  };

  const handleTimingComplete = useCallback((lyrics: TimedLyric[]) => {
    setTimedLyrics(lyrics);
    setAppState('PREVIEW');
  }, []);

  const handleBackToForm = useCallback(() => {
    setAppState('FORM');
    // Don't reset form fields, so user can easily go back and forth
  }, []);
  
  const handleBackToTiming = useCallback(() => {
    setAppState('TIMING');
  }, []);

  const handleSrtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const text = await file.text();
        const parsed = parseSrt(text);
        if (parsed.length > 0) {
            setTimedLyricsFromSrt(parsed);
            setLyricsText(parsed.map(l => l.text).join('\n'));
        } else {
            alert('無法解析 SRT 檔案或檔案中沒有歌詞。');
            e.target.value = ''; // Reset file input
        }
    } catch (error) {
        console.error("Error parsing SRT file:", error);
        alert('讀取 SRT 檔案時發生錯誤。');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        setBackgroundImages(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeImage = (index: number) => {
    setBackgroundImages(prev => prev.filter((_, i) => i !== index));
  };
  
  const runAiGeneration = async () => {
    if (!lyricsText || !songTitle || !artistName) {
      alert('請先填寫歌曲名稱、歌手名稱和歌詞，才能使用 AI 生成圖片。');
      return;
    }
    setIsLoading({ active: true, message: '正在分析歌詞並生成圖片...' });
    try {
      const images = await generateImagesForLyrics(lyricsText, songTitle, artistName);
      setBackgroundImages(prev => [...prev, ...images]);
    } catch (error) {
      console.error("AI image generation failed:", error);
      alert('AI 圖片生成失敗，請稍後再試。');
    } finally {
      setIsLoading({ active: false, message: '' });
    }
  };

  const handleAiGenerate = () => {
    if (isAiUnlocked) {
        runAiGeneration();
        return;
    }

    const password = prompt('此為公益 APP，鼓勵手動創作。若需使用 AI，請輸入密碼：');
    if (password === AI_PASSWORD) {
        alert('密碼正確，AI 功能已為您開啟！');
        setIsAiUnlocked(true);
        runAiGeneration();
    } else if (password !== null) { // User entered something but it was wrong
        alert('密碼錯誤！');
    }
    // If password is null, user clicked "Cancel", so do nothing.
  };


  const renderContent = () => {
    switch (appState) {
      case 'TIMING':
        return (
          <LyricsTiming
            lyricsText={lyricsText}
            audioUrl={audioUrl}
            backgroundImageUrl={backgroundUrls[0]} // Timing screen still uses first image
            onComplete={handleTimingComplete}
            onBack={handleBackToForm}
          />
        );
      case 'PREVIEW':
        return (
          <VideoPlayer
            timedLyrics={timedLyrics}
            audioUrl={audioUrl}
            imageUrls={backgroundUrls}
            onBack={timedLyricsFromSrt ? handleBackToForm : handleBackToTiming}
            songTitle={songTitle}
            artistName={artistName}
          />
        );
      case 'FORM':
      default:
        return (
          <div className="w-full max-w-lg p-8 space-y-6 bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700">
             {isLoading.active && <Loader message={isLoading.message} />}
            <div className="text-center">
              <MusicIcon className="w-12 h-12 mx-auto text-gray-400" />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                歌詞影片創作工具
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                上傳您的音樂作品與歌詞，開始製作專屬的動態歌詞 MV。
              </p>
            </div>
            <form onSubmit={handleStart} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="song-title" className="block text-sm font-medium text-gray-300 mb-2">
                    歌曲名稱
                  </label>
                  <input
                    type="text" id="song-title"
                    className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                    placeholder="請輸入歌曲名稱" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} required
                  />
                </div>
                <div>
                  <label htmlFor="artist-name" className="block text-sm font-medium text-gray-300 mb-2">
                    歌手名稱
                  </label>
                  <input
                    type="text" id="artist-name"
                    className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white"
                    placeholder="請輸入歌手名稱" value={artistName} onChange={(e) => setArtistName(e.target.value)} required
                  />
                </div>
              </div>

              <div>
                 <div className="flex justify-between items-center mb-2">
                    <label htmlFor="lyrics" className="block text-sm font-medium text-gray-300">
                        歌詞
                    </label>
                    <label htmlFor="srt-upload" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white cursor-pointer transition-colors">
                      <UploadIcon className="w-4 h-4" />
                      <span>上傳 SRT 檔案</span>
                      <input id="srt-upload" type="file" className="sr-only" accept=".srt" onChange={handleSrtUpload} />
                    </label>
                 </div>
                <textarea
                  id="lyrics" rows={8}
                  className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white disabled:bg-gray-800/70"
                  placeholder="請在此貼上您的歌詞，或上傳 SRT 檔案..." value={lyricsText} onChange={(e) => setLyricsText(e.target.value)}
                  required readOnly={!!timedLyricsFromSrt}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  音訊檔案
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <MusicIcon className="mx-auto h-12 w-12 text-gray-500" />
                    <div className="flex text-sm text-gray-400">
                      <label htmlFor="audio-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-gray-400 hover:text-gray-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-gray-500">
                        <span>上傳檔案</span>
                        <input id="audio-upload" name="audio-upload" type="file" className="sr-only" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} required />
                      </label>
                      <p className="pl-1">或拖曳至此</p>
                    </div>
                    <p className="text-xs text-gray-500">{audioFile ? audioFile.name : 'MP3, WAV, FLAC, etc.'}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-300">
                    背景圖片 (可選)
                  </label>
                  <button type="button" onClick={handleAiGenerate} className="flex items-center gap-2 text-sm px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                     <LockIcon className="w-4 h-4" />
                    <span>{isAiUnlocked ? '用 AI 產生背景圖' : '解鎖 AI 功能'}</span>
                  </button>
                </div>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <ImageIcon className="mx-auto h-12 w-12 text-gray-500" />
                    <div className="flex text-sm text-gray-400">
                      <label htmlFor="image-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-gray-400 hover:text-gray-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-gray-500">
                        <span>選擇圖片 (可多選)</span>
                        <input id="image-upload" type="file" className="sr-only" accept="image/*" multiple onChange={handleImageUpload} />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">已選擇 {backgroundImages.length} 張圖片</p>
                  </div>
                </div>
                {backgroundImages.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {backgroundUrls.map((url, index) => (
                            <div key={index} className="relative group">
                                <img src={url} alt={`background preview ${index + 1}`} className="w-full aspect-square object-cover rounded-md" />
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Remove image"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={!lyricsText || !audioFile || !songTitle || !artistName}
                  className="w-full flex justify-center py-3 px-4 border border-white/50 rounded-md shadow-sm text-sm font-bold text-gray-900 bg-[#a6a6a6] hover:bg-[#999999] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {timedLyricsFromSrt ? '完成並預覽' : '開始對時'}
                </button>
              </div>
            </form>
            <div className="mt-6 pt-4 border-t border-gray-700 text-center text-xs text-gray-500">
              <h4 className="font-semibold text-gray-400 mb-1">行動裝置使用建議</h4>
              <p>建議使用電腦以獲得最佳體驗，特別是影片匯出功能。若使用手機，建議橫向操作以便對時。</p>
            </div>
          </div>
        );
    }
  };

  return (
    <main className={`min-h-screen bg-gray-900 text-white p-4 transition-opacity duration-500 ${isMounted ? 'opacity-100' : 'opacity-0'}`}>
      <div className="container mx-auto flex items-center justify-center h-full">
        {renderContent()}
      </div>
    </main>
  );
};

export default App;