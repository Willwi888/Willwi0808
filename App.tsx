import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import LyricsTiming from './components/LyricsTiming';
import VideoPlayer from './components/VideoPlayer';
import MusicIcon from './components/icons/MusicIcon';
import ImageIcon from './components/icons/ImageIcon';
import UploadIcon from './components/icons/UploadIcon';
import PencilIcon from './components/icons/PencilIcon';
import SparklesIcon from './components/icons/SparklesIcon';
import VideoCameraIcon from './components/icons/VideoCameraIcon';
import { TimedLyric } from './types';
import Loader from './components/Loader';
import { parseSrt, fileToBase64 } from './utils';
import { generateImagesForLyrics, editImage, generateSrtFromLyrics, generateVideoFromImage } from './services/geminiService';
import { completionMessages, inspirationalMessages, getRandomMessage } from './messages';


type AppState = 'WELCOME' | 'FORM' | 'TIMING' | 'PREVIEW';

const DEFAULT_BG_IMAGE = 'https://storage.googleapis.com/aistudio-hosting/workspace-template-assets/lyric-video-maker/default_bg.jpg';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('WELCOME');
  const [lyricsText, setLyricsText] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [backgroundImages, setBackgroundImages] = useState<(File|string)[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [timedLyrics, setTimedLyrics] = useState<TimedLyric[]>([]);
  const [timedLyricsFromSrt, setTimedLyricsFromSrt] = useState<TimedLyric[] | null>(null);
  const [isLoading, setIsLoading] = useState<{ active: boolean; message: string }>({ active: false, message: '' });
  const [isAiUnlocked, setIsAiUnlocked] = useState(false);
  const AI_PASSWORD = '8888';
  const audioDurationRef = useRef<number>(0);
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [isKeySelected, setIsKeySelected] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const checkKey = async () => {
        if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
            setIsKeySelected(true);
        }
    };
    checkKey();
  }, []);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (aiMenuRef.current && !aiMenuRef.current.contains(event.target as Node)) {
            setIsAiMenuOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const audioUrl = audioFile ? URL.createObjectURL(audioFile) : '';
  
  const handleAudioMetadata = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    audioDurationRef.current = e.currentTarget.duration;
  };
  
  const backgroundUrls = useMemo(() => {
    if (backgroundImages.length === 0) return [DEFAULT_BG_IMAGE];
    return backgroundImages.map(img => {
        if (typeof img === 'string') return img; // Already a data URL from AI or edit
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
    alert(getRandomMessage(completionMessages));
  }, []);

  const handleBackToForm = useCallback(() => {
    setAppState('FORM');
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
            e.target.value = '';
        }
    } catch (error) {
        console.error("Error parsing SRT file:", error);
        alert('讀取 SRT 檔案時發生錯誤。');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        setBackgroundImages(prev => [...prev, ...Array.from(e.target.files!)]);
        setVideoUrl(null); // Clear video if new images are uploaded
    }
  };

  const removeImage = (index: number) => {
    setBackgroundImages(prev => prev.filter((_, i) => i !== index));
  };
  
  const runAiImageGeneration = async () => {
    if (!lyricsText || !songTitle || !artistName) {
      alert('請先填寫歌曲名稱、歌手名稱和歌詞，才能使用 AI 生成圖片。');
      return;
    }
    setIsLoading({ active: true, message: '正在分析歌詞並生成圖片...' });
    try {
      const images = await generateImagesForLyrics(lyricsText, songTitle, artistName);
      setBackgroundImages(prev => [...prev, ...images]);
      alert(getRandomMessage(inspirationalMessages));
    } catch (error) {
      console.error("AI image generation failed:", error);
      alert('AI 圖片生成失敗，請稍後再試。');
    } finally {
      setIsLoading({ active: false, message: '' });
    }
  };

  const runAiImageEdit = async (index: number) => {
    const prompt = window.prompt('請輸入您想如何編輯這張圖片（例如：讓它變成夜晚、加入星空）：');
    if (!prompt) return;
    
    setIsLoading({ active: true, message: '正在用 AI 編輯圖片...' });
    try {
        const imageToEdit = backgroundImages[index];
        let base64Image: string;
        if (typeof imageToEdit === 'string') {
            base64Image = imageToEdit;
        } else {
            base64Image = await fileToBase64(imageToEdit);
        }

        const editedImage = await editImage(base64Image, prompt);
        setBackgroundImages(prev => {
            const newImages = [...prev];
            newImages[index] = editedImage;
            return newImages;
        });
    } catch (error) {
        console.error("AI image edit failed:", error);
        alert('AI 圖片編輯失敗，請稍後再試。');
    } finally {
        setIsLoading({ active: false, message: '' });
    }
  };
  
  const runAiLyricTiming = async () => {
    if (!lyricsText || !songTitle || !artistName || !audioFile || audioDurationRef.current === 0) {
        alert('請先填寫歌曲、歌手、歌詞並上傳音訊檔案，才能使用 AI 自動抓軌。');
        return;
    }
    setIsLoading({ active: true, message: 'AI 正在為您自動抓取歌詞時間軸...' });
    try {
        const srtContent = await generateSrtFromLyrics(lyricsText, songTitle, artistName, audioDurationRef.current);
        const parsed = parseSrt(srtContent);
        if (parsed.length > 0) {
            setTimedLyricsFromSrt(parsed);
            alert(`AI 自動抓軌完成！您可以直接預覽，或先進入手動對時微調。\n\n${getRandomMessage(completionMessages)}`);
        } else {
            throw new Error("AI did not return valid SRT content.");
        }
    } catch (error) {
        console.error("AI lyric timing failed:", error);
        alert('AI 自動抓軌失敗，請稍後再試或手動對時。');
    } finally {
        setIsLoading({ active: false, message: '' });
    }
  };
  
  const runAiVideoGeneration = async () => {
    if (backgroundImages.length === 0) {
        alert('請先上傳至少一張背景圖片，作為 AI 生成影片的靈感來源。');
        return;
    }
    
    if (!isKeySelected) {
        alert("影片生成是個強大的功能，需要您選擇 API 金鑰以啟用。");
        await window.aistudio.openSelectKey();
        setIsKeySelected(true); // Assume success to avoid race condition
        return; // Ask user to click again after selecting key
    }

    setIsLoading({ active: true, message: '準備 AI 影片生成...' });
    try {
        const baseImage = backgroundImages[0];
        let base64Image: string;
        if (typeof baseImage === 'string') {
            base64Image = baseImage;
        } else {
            base64Image = await fileToBase64(baseImage);
        }
        
        const prompt = `Create a dynamic, looping video background inspired by this image, suitable for the song '${songTitle}' by '${artistName}'. Make it visually interesting but not distracting.`;
        
        const generatedVideoUrl = await generateVideoFromImage(base64Image, prompt, (message) => {
            setIsLoading({ active: true, message });
        });
        
        setVideoUrl(generatedVideoUrl);
        // Also set backgroundImages to the single source image for the album art
        setBackgroundImages([baseImage]); 
        alert(`AI 影片生成成功！\n\n${getRandomMessage(inspirationalMessages)}`);

    } catch (error) {
        console.error("AI video generation failed:", error);
        if (error instanceof Error && error.message.includes("API Key not found")) {
            alert('API Key 似乎已失效，請重新選擇。');
            setIsKeySelected(false);
            await window.aistudio.openSelectKey();
            setIsKeySelected(true);
        } else {
            alert(`AI 影片生成失敗: ${error instanceof Error ? error.message : "未知錯誤"}`);
        }
    } finally {
        setIsLoading({ active: false, message: '' });
    }
  };


  const handleAiRequest = (action: () => void) => {
    if (isAiUnlocked) {
        action();
        return;
    }
    const password = prompt('此為公益 APP，鼓勵手動創作。若需使用 AI 功能 (可能產生 API 費用)，請輸入密碼：');
    if (password === AI_PASSWORD) {
        alert('密碼正確，AI 功能已為您開啟！');
        setIsAiUnlocked(true);
        action();
    } else if (password !== null) {
        alert('密碼錯誤！');
    }
  };


  const renderContent = () => {
    switch (appState) {
      case 'WELCOME':
        return (
           <div 
                className="w-screen h-screen flex flex-col items-center justify-center text-center cursor-pointer bg-gray-900"
                onClick={() => setAppState('FORM')}
            >
                <div className="transform transition-transform hover:scale-105 duration-500">
                    <h1 className="text-5xl font-extrabold text-[#a6a6a6] tracking-widest font-serif">文字泡麵</h1>
                    <h2 className="text-2xl font-light text-gray-300 mt-4 tracking-[0.1em]">純手打の溫度</h2>
                </div>
                <p className="text-gray-400 mt-20 text-md">用你的故事，煮一碗好麵。</p>
                <p className="text-gray-500 mt-4 text-md animate-pulse">世界太快，但你還願意慢慢煮。</p>
                <p className="text-gray-600 mt-8 text-sm">點擊任意處開始創作</p>
            </div>
        );
      case 'TIMING':
        return (
          <LyricsTiming
            lyricsText={lyricsText}
            audioUrl={audioUrl}
            backgroundImageUrl={backgroundUrls[0]}
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
            videoUrl={videoUrl}
            onBack={timedLyricsFromSrt ? handleBackToForm : handleBackToTiming}
            songTitle={songTitle}
            artistName={artistName}
          />
        );
      case 'FORM':
      default:
        return (
          <div className="w-full max-w-2xl p-8 space-y-6 bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700">
             {isLoading.active && <Loader message={isLoading.message} />}
             <audio src={audioUrl} onLoadedMetadata={handleAudioMetadata} className="hidden" />
            <div className="text-center">
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                泡麵歌詞器 — 音樂調理說明
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                上傳您的作品與歌詞，開始烹煮專屬的動態歌詞 MV。<br/>（提醒：泡麵煮太久會變抒情歌）
              </p>
            </div>
            <form onSubmit={handleStart} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="song-title" className="block text-sm font-medium text-gray-300 mb-2">麵體（主歌）</label>
                  <input type="text" id="song-title" className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white" placeholder="請輸入歌曲名稱" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} required />
                  <p className="mt-1 text-xs text-gray-500">一碗沒有麵的泡麵，就是空洞的旋律。</p>
                </div>
                <div>
                  <label htmlFor="artist-name" className="block text-sm font-medium text-gray-300 mb-2">湯頭（歌手）</label>
                  <input type="text" id="artist-name" className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white" placeholder="請輸入歌手名稱" value={artistName} onChange={(e) => setArtistName(e.target.value)} required />
                  <p className="mt-1 text-xs text-gray-500">誰熬的湯，誰的味道最濃。</p>
                </div>
              </div>

              <div>
                 <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                    <label htmlFor="lyrics" className="block text-sm font-medium text-gray-300">加蛋加菜區（歌詞）</label>
                    <div className="flex items-center gap-4">
                        <label htmlFor="srt-upload" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white cursor-pointer transition-colors"><UploadIcon className="w-4 h-4" /><span>上傳 SRT</span><input id="srt-upload" type="file" className="sr-only" accept=".srt" onChange={handleSrtUpload} /></label>
                    </div>
                 </div>
                 <p className="text-xs text-gray-400 -mt-1 mb-2">匯入 SRT 或直接貼上歌詞，讓湯頭更有層次、味道更溫柔。</p>
                <textarea id="lyrics" rows={6} className="block w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm text-white disabled:bg-gray-800/70" placeholder="請在此貼上您的歌詞..." value={lyricsText} onChange={(e) => setLyricsText(e.target.value)} required readOnly={!!timedLyricsFromSrt} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">🍲 主湯音訊檔（選擇乾濕吃法）</label>
                <div className="mt-1 flex flex-col justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                    <div className="space-y-2 text-center">
                        <div className="flex justify-center text-sm text-gray-400">
                            <label htmlFor="audio-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-gray-400 hover:text-gray-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-gray-500 px-3 py-1">
                                <span>上傳檔案</span><input id="audio-upload" name="audio-upload" type="file" className="sr-only" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} required />
                            </label>
                            <p className="pl-1 self-center">或直接拖曳進來</p>
                        </div>
                        <div className="text-xs text-gray-500 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-left pt-2 px-2">
                            <div>
                                <p className="font-semibold text-gray-400">乾吃法</p>
                                <p>適合清唱版本或純伴奏。歌詞乾乾淨淨，節奏清晰入味。</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-400">濕吃法</p>
                                <p>適合完整版音軌（含人聲＋伴奏）。聽完要配衛生紙，情緒湯濃得化不開。</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-600 pt-2">{audioFile ? audioFile.name : '支援格式：MP3, WAV, FLAC 等。'}</p>
                    </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                  <label className="block text-sm font-medium text-gray-300">配料加成（專輯／背景）</label>
                    <div className="relative" ref={aiMenuRef}>
                        <button 
                            type="button" 
                            onClick={() => isAiUnlocked ? setIsAiMenuOpen(p => !p) : handleAiRequest(() => setIsAiMenuOpen(true))} 
                            className="flex items-center gap-2 px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors text-sm"
                        >
                            <SparklesIcon className="w-4 h-4" />
                            <span>天選之桶</span>
                        </button>
                        {isAiMenuOpen && isAiUnlocked && (
                            <div className="absolute right-0 bottom-full mb-2 w-48 bg-gray-700 rounded-md shadow-lg z-20 border border-gray-600">
                                <ul className="py-1">
                                    <li>
                                        <button onClick={() => { handleAiRequest(runAiLyricTiming); setIsAiMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2 transition-colors">
                                            <SparklesIcon className="w-4 h-4 text-purple-400" /> AI 自動抓軌
                                        </button>
                                    </li>
                                    <li>
                                        <button onClick={() => { handleAiRequest(runAiImageGeneration); setIsAiMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2 transition-colors">
                                            <ImageIcon className="w-4 h-4 text-green-400" /> AI 生成圖片
                                        </button>
                                    </li>
                                    <li>
                                        <button onClick={() => { handleAiRequest(runAiVideoGeneration); setIsAiMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 flex items-center gap-2 transition-colors">
                                            <VideoCameraIcon className="w-4 h-4 text-blue-400" /> AI 生成影片
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
                 {isAiUnlocked && !isKeySelected && <div className="text-xs text-center text-blue-300 bg-blue-900/50 p-2 rounded-md mb-2">AI 影片生成是 Beta 功能，需要您 <a href="#" onClick={(e) => { e.preventDefault(); window.aistudio.openSelectKey(); setIsKeySelected(true); }} className="font-bold underline">選擇 API 金鑰</a>。詳情請見 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline">計費說明</a>。</div>}
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                        <ImageIcon className="mx-auto h-12 w-12 text-gray-500" />
                        <div className="flex text-sm text-gray-400">
                            <label htmlFor="image-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-gray-400 hover:text-gray-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-gray-500">
                                <span>上傳圖片</span>
                                <input id="image-upload" type="file" className="sr-only" accept="image/*" multiple onChange={handleImageUpload} />
                            </label>
                        </div>
                        <p className="text-xs text-gray-500 px-4">選對配料，整碗更香。（也可用專輯封面或現場照片當背景）</p>
                        <p className="text-xs text-gray-600">{videoUrl ? "已生成 AI 影片背景" : `已選擇 ${backgroundImages.length} 張圖片 | PNG, JPG`}</p>
                    </div>
                </div>
                {backgroundImages.length > 0 && !videoUrl && (
                    <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {backgroundUrls.map((url, index) => (
                            <div key={index} className="relative group"><img src={url} alt={`background preview ${index + 1}`} className="w-full aspect-square object-cover rounded-md" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button type="button" onClick={() => handleAiRequest(() => runAiImageEdit(index))} className="text-white rounded-full p-1.5 hover:bg-white/20" aria-label="Edit with AI"><PencilIcon className="h-5 w-5" /></button>
                                  <button type="button" onClick={() => removeImage(index)} className="text-white rounded-full p-1.5 hover:bg-white/20" aria-label="Remove image"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
              </div>

              <div>
                <button type="submit" disabled={!lyricsText || !audioFile || !songTitle || !artistName} className="w-full flex justify-center py-3 px-4 border border-white/50 rounded-md shadow-sm text-sm font-bold text-gray-900 bg-[#a6a6a6] hover:bg-[#999999] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  {timedLyricsFromSrt ? '煮好了，試吃看看' : '開始煮麵'}
                </button>
              </div>
            </form>
            <div className="mt-6 pt-4 border-t border-gray-700 text-center text-xs text-gray-500">
              <h4 className="font-semibold text-gray-400 mb-1">用心煮好麵 阿嬤說慢慢敲</h4>
              <p>阿嬤說：煮麵要穩，別邊滑手機邊撈麵。建議用電腦操作，手機煮麵容易變燒焦。</p>
            </div>
          </div>
        );
    }
  };

  return (
    <main className={`min-h-screen bg-gray-900 text-white transition-opacity duration-500 ${isMounted ? 'opacity-100' : 'opacity-0'} ${appState !== 'WELCOME' && 'p-4'}`}>
        {appState === 'WELCOME' ? (
            renderContent()
        ) : (
            <div className="container mx-auto flex items-center justify-center h-full">
                {renderContent()}
            </div>
        )}
    </main>
  );
};

export default App;