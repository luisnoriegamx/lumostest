export const config = {
    runtime: 'edge',
};

// Solo usar proveedores con claves válidas (las que están hardcodeadas funcionan)
const PROVIDERS = [
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

        const provider = PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)];

        if (!provider.key) {
            return new Response(JSON.stringify({ error: `Clave API ausente para ${provider.name}` }), { status: 500 });
        }

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

        const response = await fetch(provider.url(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${provider.key}`,
                'HTTP-Referer': 'https://psychoart-test.vercel.app',
                'X-Title': 'PsychoArt Test'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        
        // Extraer texto del formato OpenAI
        const resultText = data.choices?.[0]?.message?.content || "";

        if (!resultText) {
            return new Response(JSON.stringify({ 
                error: "Fallo en el análisis", 
                details: data.error || "Respuesta vacía",
                provider: provider.name 
            }), { status: 500 });
        }

        // Devolver en el formato que espera el frontend
        return new Response(JSON.stringify({
            candidates: [{
                content: {
                    parts: [{ text: resultText }]
                }
            }],
            provider: provider.name
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
