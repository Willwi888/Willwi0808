import { TimedLyric } from './types';

// Function to parse HH:MM:SS,ms into seconds
const parseSrtTime = (time: string): number => {
    const parts = time.split(':');
    const secondsAndMs = parts[2].split(',');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(secondsAndMs[0], 10);
    const milliseconds = parseInt(secondsAndMs[1], 10);
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
};

/**
 * Parses a string of SRT content into an array of TimedLyric objects.
 * @param srtContent The raw string content from an SRT file.
 * @returns An array of timed lyrics.
 */
export const parseSrt = (srtContent: string): TimedLyric[] => {
    const lyrics: TimedLyric[] = [];
    const blocks = srtContent.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);

    for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length >= 2) {
            const timeLineIndex = lines.findIndex(line => line.includes('-->'));
            
            if (timeLineIndex !== -1) {
                const timeLine = lines[timeLineIndex];
                const timeMatch = timeLine.match(/(\d{1,2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2},\d{3})/);
                
                if (timeMatch) {
                    const startTime = parseSrtTime(timeMatch[1]);
                    const endTime = parseSrtTime(timeMatch[2]);
                    const text = lines.slice(timeLineIndex + 1).join('\n').trim();
                    if (text) {
                        lyrics.push({ text, startTime, endTime });
                    }
                }
            }
        }
    }
    return lyrics;
};

/**
 * Converts a File object to a base64 data URL.
 * @param file The file to convert.
 * @returns A promise that resolves with the base64 string.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};