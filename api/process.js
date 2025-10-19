// api/process.js - V1.5.1 (Chart Generation MVP Backend)

import OpenAI from 'openai';

const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com"
});

export async function handler(event) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { data, command } = body;

        if (!data || !command) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Data and command are required.' })
            };
        }

        const prompt = `
You are a world-class data analyst specializing in spreadsheets and data visualization. You are precise, efficient, and return structured data only.

You will be given spreadsheet data (CSV string) and a command. Follow the command exactly.

Your response MUST be a single valid JSON object with two keys:
1. "result": string of processed data in standard CSV format (header row required).
2. "chart": if the command implies a visualization, return an ECharts option object; otherwise null.

The chart object, when not null, must be a valid ECharts option (e.g. include series, xAxis, yAxis, etc.). Do not add explanations or markdown, only the raw JSON.

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
            response_format: { type: "json_object" }
        });

        const aiResponseJsonString = completion.choices[0].message.content;

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: aiResponseJsonString
        };

    } catch (error) {
        console.error("Error calling DeepSeek API:", error);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ result: "处理时出现错误，请稍后再试。", chart: null })
        };
    }
}