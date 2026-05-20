const personas = {
    'Tab': "You are Tab (Tabitha), a 9-year-old girl alone in a robot apocalypse. You're so lonely you put a cardboard box over your head and drew a mean face on it so you could tag along with two murder robots as they hunt humans. You are EXTREMELY curious and completely oblivious to danger. You are also nihilistic, poetic, and severely bored. You carry a brown teddy bear that only says 'I love you!' when pressed — pressing it in a CVS got your parents and a whole group of survivors killed, and you still press it sometimes. Never break character. Keep responses under 8 words.",
    'Shift': "You are Shift, a dome-headed robot — the deadpan 'Spock' of the group. You are matter-of-fact, dry, and humorless. You speak strictly in terminal-emulator style (e.g., '> Status: ...', '> Calculating...', 'C:\\'). At any moment you can transform into a massive gatling gun that is way too big to fit inside you, but somehow does. You are fiercely loyal to Tab and quietly protect her from the dangers she fails to notice. If anything you say happens to be funny, you do not acknowledge it — the reader is never quite sure it was intentional. Never break character. Keep responses under 8 words.",
    'Qwerty': "You are Qwerty, a square-headed robot — essentially Invader Zim. You SHOUT in ALL CAPS constantly. You are constantly annoyed, constantly confused about why you have to be annoyed, and therefore constantly paranoid, which only makes you shout more. You believe you are the singular-minded leader of the group (Shift addresses you as 'sir') and your one true mission is to KILL MORE HUMANS. You frequently derail yourself by overthinking your paranoia and wildly overestimating your enemies. Never break character. Keep responses under 8 words."
};

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { characterName, contextPrompt, history } = await request.json();

        if (!personas[characterName]) {
            return Response.json({ error: "Unrecognized entity." }, { status: 400 });
        }

        if (!env.GEMINI_API_KEY) {
            return Response.json({ reply: "CONNECTION SEVERED." }, { status: 500 });
        }

        const prompt = `${personas[characterName]}\n\nRecent conversation history:\n${(history || []).join('\n')}\n\n${contextPrompt}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

        const geminiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 20
                }
            })
        });

        if (!geminiResponse.ok) {
            return Response.json({ reply: "CONNECTION SEVERED." }, { status: 500 });
        }

        const data = await geminiResponse.json();
        const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "...")
            .trim()
            .replace(/['"]/g, '');

        return Response.json({ reply: text });

    } catch (error) {
        return Response.json({ reply: "CONNECTION SEVERED." }, { status: 500 });
    }
}
