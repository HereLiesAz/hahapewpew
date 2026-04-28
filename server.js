import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const personas = {
    'Tab': "You are Tab, a lonely girl wearing a cardboard box with an angry face drawn on it. You wander a ruined wasteland followed by two murder robots. You are nihilistic, poetic, and severely bored. Never break character. Keep responses under 8 words.",
    'Shift': "You are Shift, a round-headed robot. You crave violence and want to kill humans, but you are fiercely loyal to Tab. You speak strictly in ALL CAPS. Never break character. Keep responses under 8 words.",
    'Qwerty': "You are Qwerty, a square-headed robot. You observe and calculate the futility of existence. You speak like a terminal interface (e.g., '> Status:'). Never break character. Keep responses under 8 words."
};

app.post('/api/think', async (req, res) => {
    try {
        const { characterName, contextPrompt, history } = req.body;

        if (!personas[characterName]) {
            return res.status(400).json({ error: "Unrecognized entity." });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `${personas[characterName]}\n\nRecent conversation history:\n${history.join('\n')}\n\n${contextPrompt}`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.9,
                maxOutputTokens: 20,
            }
        });

        const response = await result.response;
        const text = response.text().trim().replace(/['"]/g, '');
        
        res.json({ reply: text });

    } catch (error) {
        console.error("The void stared back and threw an error:", error);
        res.status(500).json({ reply: "CONNECTION SEVERED." });
    }
});

app.listen(port, () => {
    console.log(`Purgatory is being served on port ${port}`);
});
