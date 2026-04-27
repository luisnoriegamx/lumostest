export const config = {
    runtime: 'edge', // Ejecución ultra rápida en el borde
};

// Configuración de proveedores de IA
const PROVIDERS = [
    {
        name: 'Google Gemini',
        url: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        key: process.env.GEMINI_API_KEY,
        type: 'google'
    },
    {
        name: 'Groq Cloud',
        url: () => 'https://api.groq.com/openai/v1/chat/completions',
        key: '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',
        model: 'llama-3.2-11b-vision-preview',
        type: 'openai'
    },
    {
        name: 'OpenRouter',
        url: () => 'https://openrouter.ai/api/v1/chat/completions',
        key: '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',
        model: 'google/gemini-2.0-flash-exp:free',
        type: 'openai'
    }
];

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response("Método no permitido", { status: 405 });
    }

    try {
        const { image, prompt } = await req.json();

        // Seleccionar un proveedor aleatorio para distribuir la carga de tokens
        const provider = PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)];

        if (!provider.key) {
            return new Response(JSON.stringify({ error: `Clave API ausente para ${provider.name}` }), { status: 500 });
        }

        let response;
        if (provider.type === 'google') {
            // Formato específico de Google Gemini
            const body = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/png", data: image } }
                    ]
                }]
            };
            response = await fetch(provider.url(provider.key), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        } else {
            // Formato estándar OpenAI (Groq y OpenRouter)
            const body = {
                model: provider.model,
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: `data:image/png;base64,${image}` } }
                    ]
                }]
            };
            response = await fetch(provider.url(), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${provider.key}`,
                    'HTTP-Referer': 'https://psychoart-test.vercel.app',
                    'X-Title': 'PsychoArt Test'
                },
                body: JSON.stringify(body)
            });
        }

        const data = await response.json();

        // Extraer el texto de forma segura según el formato del proveedor
        let resultText = "";
        if (provider.type === 'google') {
            resultText = data.candidates && data.candidates && data.candidates.content && data.candidates.content.parts && data.candidates.content.parts ? data.candidates.content.parts.text : "";
        } else {
            resultText = data.choices && data.choices && data.choices.message ? data.choices.message.content : "";
        }

        if (!resultText) {
            const errorInfo = data.error || "Respuesta vacía del proveedor";
            return new Response(JSON.stringify({ error: "Fallo en el análisis", details: errorInfo, provider: provider.name }), { status: 500 });
        }

        return new Response(JSON.stringify({ text: resultText, provider: provider.name }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
