export const config = {
    runtime: 'edge',
};

// Usar SOLO Google Gemini (es el único que funciona bien con imágenes gratis)
// REEMPLAZA 'TU_API_KEY_AQUI' con tu key real de https://aistudio.google.com/
const GEMINI_API_KEY = 'AIzaSyBn0sjVhTlp-wsJHTXK-83jau24vhOnKlA';

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

        console.log('Enviando a Google Gemini...');

        const geminiBody = {
            contents: [{
                parts: [
                    { text: prompt },
                    { 
                        inlineData: { 
                            mimeType: "image/png", 
                            data: image 
                        } 
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
                topP: 0.95
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_NONE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_NONE"
                }
            ]
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geminiBody)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('Error Gemini:', data);
            let errorMessage = 'Error del servicio';
            
            if (data.error) {
                errorMessage = data.error.message || data.error.status || 'Error desconocido';
                if (data.error.status === 'PERMISSION_DENIED' || data.error.message?.includes('API key')) {
                    errorMessage = 'La API key de Gemini no es válida. Obtén una gratis en https://aistudio.google.com/';
                }
            }
            
            return new Response(JSON.stringify({ 
                error: errorMessage,
                details: data
            }), { status: response.status, headers });
        }

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            return new Response(JSON.stringify({ 
                error: 'Respuesta inválida de Gemini',
                details: data
            }), { status: 500, headers });
        }

        let resultText = data.candidates[0].content.parts[0].text;
        
        if (!resultText) {
            return new Response(JSON.stringify({ 
                error: 'Gemini no generó texto'
            }), { status: 500, headers });
        }

        // Limpiar el resultado
        let cleanResult = resultText;
        cleanResult = cleanResult.replace(/```html\s*/g, '');
        cleanResult = cleanResult.replace(/```\s*$/g, '');
        cleanResult = cleanResult.replace(/```/g, '');
        
        // Validar que sea HTML
        if (!cleanResult.includes('<!DOCTYPE html>') && !cleanResult.includes('<html')) {
            cleanResult = `<!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"><style>body{font-family:sans-serif;padding:20px}</style></head>
            <body>
                <div style="max-width:800px;margin:auto">
                    <h1>Informe de Análisis</h1>
                    <div>${cleanResult.replace(/\n/g, '<br>')}</div>
                </div>
            </body>
            </html>`;
        }

        return new Response(JSON.stringify({
            candidates: [{
                content: cleanResult
            }],
            success: true
        }), { status: 200, headers });

    } catch (error) {
        console.error('Error interno:', error);
        return new Response(JSON.stringify({ 
            error: error.message || 'Error interno del servidor'
        }), { status: 500, headers });
    }
}
