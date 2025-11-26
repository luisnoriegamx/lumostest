// api/analyze.js
export const config = {
    runtime: 'edge', // Hace que sea súper rápido
};

export default async function handler(req) {
    // Solo aceptamos peticiones POST
    if (req.method !== 'POST') {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        // 1. Recibimos la imagen y el prompt desde tu frontend
        const { image, prompt } = await req.json();

        // 2. Leemos la API KEY segura del servidor (no visible al usuario)
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Server Error: API Key missing" }), { status: 500 });
        }

        // 3. Preparamos la llamada a Google Gemini 2.0 Flash
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const body = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/png", data: image } }
                ]
            }]
        };

        // 4. Llamamos a Google desde el servidor
        const googleResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await googleResponse.json();

        // 5. Devolvemos la respuesta limpia al frontend
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}