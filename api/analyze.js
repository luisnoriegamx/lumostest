export const config = {
    runtime: 'edge',
};

// Usar Google Gemini (más confiable para visión)
// NOTA: Necesitas obtener una API KEY gratis en https://aistudio.google.com/
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDZBcHcYqNqUQ0jKqLqLqLqLqLqLqLqLqLqLq'; // Reemplaza con tu key real

// Fallback: OpenRouter con gemini-vision
const PROVIDERS = [
    {
        name: 'Google Gemini',
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        type: 'google'
    },
    {
        name: 'OpenRouter Gemini',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: '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',
        model: 'google/gemini-2.0-flash-exp:free',
        type: 'openai'
    }
];

export default async function handler(req) {
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

        // Intentar con Google Gemini primero
        let result = null;
        let error = null;

        // Proveedor 1: Google Gemini
        try {
            console.log('Intentando con Google Gemini...');
            const geminiBody = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: "image/png", data: image } }
                    ]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 4096
                }
            };

            const geminiResponse = await fetch(PROVIDERS[0].url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geminiBody)
            });

            const geminiData = await geminiResponse.json();
            
            if (geminiResponse.ok && geminiData.candidates && geminiData.candidates[0]) {
                const text = geminiData.candidates[0].content.parts[0].text;
                if (text) {
                    result = text;
                    console.log('✅ Google Gemini exitoso');
                }
            } else {
                error = geminiData.error?.message || 'Respuesta inválida de Gemini';
                console.log('Gemini falló:', error);
            }
        } catch (err) {
            console.log('Error con Gemini:', err.message);
            error = err.message;
        }

        // Si Gemini falla, intentar con OpenRouter
        if (!result) {
            try {
                console.log('Intentando con OpenRouter...');
                const openRouterBody = {
                    model: PROVIDERS[1].model,
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

                const orResponse = await fetch(PROVIDERS[1].url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${PROVIDERS[1].key}`,
                        'HTTP-Referer': 'https://psychoart-test.vercel.app',
                        'X-Title': 'PsychoArt Test'
                    },
                    body: JSON.stringify(openRouterBody)
                });

                const orData = await orResponse.json();
                
                if (orResponse.ok && orData.choices && orData.choices[0]) {
                    result = orData.choices[0].message.content;
                    console.log('✅ OpenRouter exitoso');
                } else {
                    error = orData.error?.message || 'Respuesta inválida de OpenRouter';
                    console.log('OpenRouter falló:', error);
                }
            } catch (err) {
                console.log('Error con OpenRouter:', err.message);
                error = err.message;
            }
        }

        // Si ambos fallan, devolver error detallado
        if (!result) {
            return new Response(JSON.stringify({ 
                error: 'No se pudo generar el análisis',
                details: 'Ambos proveedores fallaron. Por favor, intenta nuevamente.',
                technical: error
            }), { status: 500, headers });
        }

        // Limpiar el resultado de posibles marcadores HTML
        let cleanResult = result;
        if (cleanResult.startsWith('```html')) {
            cleanResult = cleanResult.replace(/```html/g, '').replace(/```/g, '');
        }
        if (cleanResult.startsWith('```')) {
            cleanResult = cleanResult.replace(/```/g, '');
        }

        // Devolver en formato compatible
        return new Response(JSON.stringify({
            candidates: [{
                content: cleanResult
            }],
            success: true,
            provider: result.includes('Gemini') ? 'Google Gemini' : 'OpenRouter'
        }), { status: 200, headers });

    } catch (error) {
        console.error('Error interno:', error);
        return new Response(JSON.stringify({ 
            error: 'Error interno del servidor',
            message: error.message
        }), { status: 500, headers });
    }
}
