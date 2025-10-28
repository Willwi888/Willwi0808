import { GoogleGenAI, Type, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    // In a real app, you might want to handle this more gracefully,
    // but for this context, throwing an error is fine.
    throw new Error("API_KEY environment variable not set. Please add it to your environment.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Generates a set of background images based on the lyrics of a song.
 * This is a multi-step process:
 * 1. Ask a text model to analyze lyrics and generate descriptive prompts.
 * 2. Use an image model to generate an image for each prompt.
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
