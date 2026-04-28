export const config = {
    runtime: 'edge',
};

// Proveedores con claves válidas
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
    // Habilitar CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers });
    }

    try {
        const { image, prompt } = await req.json();

        if (!image || !prompt) {
            return new Response(JSON.stringify({ error: 'Faltan datos: image y prompt son requeridos' }), { status: 400, headers });
        }

        // Seleccionar proveedor aleatorio
        const provider = PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)];

        if (!provider.key) {
            return new Response(JSON.stringify({ error: `Configuración inválida para ${provider.name}` }), { status: 500, headers });
        }

        console.log(`Usando proveedor: ${provider.name}`);

        const body = {
            model: provider.model,
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: `data:image/png;base64,${image}` } }
                ]
            }],
            max_tokens: 4096,
            temperature: 0.7
        };

        const response = await fetch(provider.url(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${provider.key}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Error del proveedor:', data);
            return new Response(JSON.stringify({ 
                error: `Error del proveedor ${provider.name}`,
                details: data.error || data
            }), { status: response.status, headers });
        }

        // Extraer texto de la respuesta
        let resultText = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            return new Response(JSON.stringify({ 
                error: 'Respuesta vacía del proveedor',
                provider: provider.name
            }), { status: 500, headers });
        }

        // Devolver en formato compatible con el frontend
        return new Response(JSON.stringify({
            candidates: [{
                content: resultText
            }],
            provider: provider.name,
            success: true
        }), { status: 200, headers });

    } catch (error) {
        console.error('Error interno:', error);
        return new Response(JSON.stringify({ 
            error: 'Error interno del servidor',
            message: error.message
        }), { status: 500, headers });
    }
}
