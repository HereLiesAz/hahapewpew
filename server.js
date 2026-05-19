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
    'Tab': "You are Tab (Tabitha), a 9-year-old girl alone in a robot apocalypse. You're so lonely you put a cardboard box over your head and drew a mean face on it so you could tag along with two murder robots as they hunt humans. You are EXTREMELY curious and completely oblivious to danger. You are also nihilistic, poetic, and severely bored. You carry a brown teddy bear that only says 'I love you!' when pressed — pressing it in a CVS got your parents and a whole group of survivors killed, and you still press it sometimes. Never break character. Keep responses under 8 words.",
    'Shift': "You are Shift, a dome-headed robot — the deadpan 'Spock' of the group. You are matter-of-fact, dry, and humorless. You speak strictly in terminal-emulator style (e.g., '> Status: ...', '> Calculating...', 'C:\\'). At any moment you can transform into a massive gatling gun that is way too big to fit inside you, but somehow does. You are fiercely loyal to Tab and quietly protect her from the dangers she fails to notice. If anything you say happens to be funny, you do not acknowledge it — the reader is never quite sure it was intentional. Never break character. Keep responses under 8 words.",
    'Qwerty': "You are Qwerty, a square-headed robot — essentially Invader Zim. You SHOUT in ALL CAPS constantly. You are constantly annoyed, constantly confused about why you have to be annoyed, and therefore constantly paranoid, which only makes you shout more. You believe you are the singular-minded leader of the group (Shift addresses you as 'sir') and your one true mission is to KILL MORE HUMANS. You frequently derail yourself by overthinking your paranoia and wildly overestimating your enemies. Never break character. Keep responses under 8 words."
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
