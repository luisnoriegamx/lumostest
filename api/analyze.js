export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { image, prompt } = await req.json();
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "API Key missing in environment" }), { status: 500 });
        }

        // Usamos Gemini 2.0 Flash (muy rápido para evitar timeouts)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const body = {
            contents: [{
                parts: [
                    { text: prompt },
                    { 
                        inlineData: { // CORRECCIÓN: CamelCase obligatorio para Google API
                            mimeType: "image/png", 
                            data: image 
                        } 
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 4096,
            }
        };

        const googleResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!googleResponse.ok) {
            const errorData = await googleResponse.json();
            return new Response(JSON.stringify({ error: "Google API Error", details: errorData }), { status: googleResponse.status });
        }

        const data = await googleResponse.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
