// api/process.js - V1.2 (Netlify Functions Final Version)

import OpenAI from 'openai';

const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com"
});

export async function handler(event, context) {
    // Netlify Functions use 'event' as the first argument

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        // The request body is in event.body, and it's a string
        const body = JSON.parse(event.body || '{}');
        const { data, command } = body;

        if (!data || !command) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Data and command are required.' })
            };
        }

        const prompt = `
You are a world-class data analyst specializing in spreadsheets. You are precise and efficient.
You will be given user-provided spreadsheet data as a string, and a command as a string.
Your task is to strictly follow the user's command to process the data.
Your output MUST be a standard CSV (Comma-Separated Values) format string. The first line of the CSV must be the header row.
You MUST ONLY return the raw CSV string, without any introductory text, explanations, apologies, or markdown formatting like \`\`\`.

Data:
---
${data}
---
Command:
---
${command}
---
`;

        const completion = await deepseek.chat.completions.create({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
        });

        const aiResponse = completion.choices[0].message.content;

        // Correct return format for a successful response
        return {
            statusCode: 200,
            body: JSON.stringify({ result: aiResponse })
        };

    } catch (error) {
        console.error("Error calling DeepSeek API:", error);

        // Correct return format for an error response
        return {
            statusCode: 500,
            body: JSON.stringify({ result: "处理时出现错误，请稍后再试。" })
        };
    }
}