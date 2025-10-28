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
    // Normalize line endings and split into blocks
    const blocks = srtContent.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);

    for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length >= 2) { // Minimum for a valid block is a time line and a text line
            // The first line could be an index, but we don't strictly need it.
            // We search for the timeline, which is more reliable.
            const timeLineIndex = lines.findIndex(line => line.includes('-->'));
            
            if (timeLineIndex !== -1) {
                const timeLine = lines[timeLineIndex];
                const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
                
                if (timeMatch) {
                    const startTime = parseSrtTime(timeMatch[1]);
                    const endTime = parseSrtTime(timeMatch[2]);
                    const text = lines.slice(timeLineIndex + 1).join('\n').trim();
                    if (text) { // Only add if there is lyric text
                        lyrics.push({ text, startTime, endTime });
                    }
                }
            }
        }
    }
    return lyrics;
};
