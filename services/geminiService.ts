import { GoogleGenAI, Type, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set. Please add it to your environment.");
}

const getAiClient = () => new GoogleGenAI({ apiKey: API_KEY });

/**
 * Generates a set of background images based on the lyrics of a song.
 * @param lyrics The full lyrics of the song.
 * @param songTitle The title of the song.
 * @param artistName The name of the artist.
 * @param imageCount The number of images to generate.
 * @returns A promise that resolves to an array of base64 data URLs for the generated images.
 */
export const generateImagesForLyrics = async (
    lyrics: string,
    songTitle: string,
    artistName: string,
    imageCount: number = 4
): Promise<string[]> => {
    try {
        console.log("Step 1: Generating image prompts from lyrics...");
        const ai = getAiClient();
        const getPromptsPrompt = `Based on the lyrics for the song '${songTitle}' by ${artistName}, identify ${imageCount} distinct visual scenes or moods that capture the song's essence.
For each scene, provide a concise, descriptive prompt suitable for an AI image generation model. The prompts should be in English for best results.
Return the result as a JSON array of strings.

Example response:
[
  "A lone figure walking on a rainy, neon-lit city street at night, reflection in a puddle.",
  "Sunlight streaming through the leaves of a dense, green forest.",
  "A vast, empty desert under a starry sky with a full moon.",
  "Close up of two hands, weathered and old, gently held together."
]

Lyrics:
---
${lyrics}
---
`;
        const promptResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: getPromptsPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                        description: "A descriptive prompt for an image generation model.",
                    },
                },
            },
        });
        
        const promptsText = promptResponse.text;
        const prompts: string[] = JSON.parse(promptsText);
        
        if (!prompts || prompts.length === 0) {
            throw new Error("AI did not return valid image prompts.");
        }

        console.log(`Step 2: Generating ${prompts.length} images...`);

        const imagePromises = prompts.map(async (prompt) => {
            const imageResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [{ text: prompt }],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });
            
            const part = imageResponse.candidates?.[0]?.content?.parts?.[0];
            if (part?.inlineData) {
                const base64ImageBytes = part.inlineData.data;
                const mimeType = part.inlineData.mimeType;
                return `data:${mimeType};base64,${base64ImageBytes}`;
            }
            throw new Error(`Failed to generate image for prompt: "${prompt}"`);
        });

        const images = await Promise.all(imagePromises);
        console.log("Step 3: Image generation complete.");
        return images;

    } catch (error) {
        console.error("Error in AI image generation pipeline:", error);
        throw error;
    }
};

/**
 * Edits an image based on a text prompt.
 * @param base64ImageData The base64 data URL of the image to edit.
 * @param prompt The text prompt describing the desired edit.
 * @returns A promise that resolves to the base64 data URL of the edited image.
 */
export const editImage = async (base64ImageData: string, prompt: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const [header, data] = base64ImageData.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1];
        if (!data || !mimeType) {
            throw new Error("Invalid base64 image data");
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data, mimeType } },
                    { text: prompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part?.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
        throw new Error("Failed to edit image.");

    } catch (error) {
        console.error("Error in AI image editing:", error);
        throw error;
    }
};

/**
 * Generates an SRT timestamp file from lyrics text and song duration.
 * @param lyrics The full lyrics of the song.
 * @param songTitle The title of the song.
 * @param artistName The name of the artist.
 * @param duration The duration of the audio in seconds.
 * @returns A promise that resolves to the SRT content as a string.
 */
export const generateSrtFromLyrics = async (
    lyrics: string,
    songTitle: string,
    artistName: string,
    duration: number
): Promise<string> => {
    try {
        const ai = getAiClient();
        const prompt = `You are an expert in music lyric timing. Create a standard SRT file for the song '${songTitle}' by '${artistName}'.
The total duration of the song is ${Math.round(duration)} seconds.
Analyze the provided lyrics to identify verses, choruses, bridges, and pauses.
Generate realistic start and end timestamps for each line in the format HH:MM:SS,ms.
Ensure the final timestamp does not exceed the song duration.
The output MUST be only the raw SRT content, with nothing else before or after it.

Lyrics:
---
${lyrics}
---
`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const srtContent = response.text;
        if (!srtContent || !srtContent.includes('-->')) {
            throw new Error("Generated content is not a valid SRT format.");
        }
        return srtContent;
    } catch (error) {
        console.error("Error generating SRT from lyrics:", error);
        throw error;
    }
};


/**
 * Generates a video from a base image and a prompt.
 * @param base64ImageData The base64 data URL of the image to use.
 * @param prompt A prompt to guide the video generation.
 * @param onProgress A callback to report progress updates.
 * @returns A promise that resolves to the URL of the generated video.
 */
export const generateVideoFromImage = async (
    base64ImageData: string,
    prompt: string,
    onProgress: (message: string) => void
): Promise<string> => {
    try {
        const ai = getAiClient();
        const [header, imageBytes] = base64ImageData.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1];
        if (!imageBytes || !mimeType) {
            throw new Error("Invalid base64 image data");
        }

        onProgress('正在初始化影片生成...');
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            image: { imageBytes, mimeType },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        onProgress('影片生成中，這可能需要幾分鐘...');
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            onProgress('正在檢查生成進度...');
            operation = await ai.operations.getVideosOperation({ operation: operation });
            if (operation.error?.message.includes("Requested entity was not found")) {
                 throw new Error("API Key not found or invalid. Please re-select your key.");
            }
        }

        onProgress('正在擷取影片...');
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error("Video generation succeeded, but no download link was found.");
        }
        
        const response = await fetch(`${downloadLink}&key=${API_KEY}`);
        if (!response.ok) {
            throw new Error(`Failed to download video: ${response.statusText}`);
        }
        const videoBlob = await response.blob();
        return URL.createObjectURL(videoBlob);
    } catch (error) {
        console.error("Error in AI video generation:", error);
        if (error instanceof Error && error.message.includes("API Key not found")) {
             throw error; // Re-throw specific error for UI handling
        }
        console.error("Full error object:", error);
        throw new Error(`影片生成失敗： ${error instanceof Error ? error.message : String(error)}`);
    }
};