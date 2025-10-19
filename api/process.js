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
        const { data, command, originalData, latestSchema, originalSchema } = body;

        if (!data || !command) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Data and command are required.' })
            };
        }

        const latestData = typeof data === 'string' ? data : '';
        const initialData = typeof originalData === 'string' && originalData.trim() !== ''
            ? originalData
            : latestData;

        const sanitizedLatestSchema = normalizeSchema(latestSchema, latestData);
        const sanitizedOriginalSchema = normalizeSchema(originalSchema, initialData);

        const prompt = `
You are a world-class data analyst specializing in spreadsheets and data visualization. You are precise, efficient, and return structured data only.

You will receive two CSV inputs and their detected schemas:
1. Latest dataset: the most recent table you produced in this conversation.
2. Original dataset: the raw data as initially uploaded by the user.

Operate on the latest dataset by default so your work remains consistent across turns. If the latest dataset is missing columns or rows required by the command, you may consult the original dataset and reintroduce the necessary fields.

Key requirements:
- Always review latest schema and original schema information before generating a result.
- Preserve every column present in the latest schema unless the user explicitly instructs you to drop it.
- When the user requests a column that is missing from the latest schema but present in the original schema, bring the column back using the original data.
- Keep column ordering aligned with the latest schema; append reintroduced columns at the end if no prior ordering guidance exists.
- The client will reject responses that drop columns from the latest schema, so comply strictly with these rules.

Your response MUST be a single valid JSON object with two keys:
1. "result": string of processed data in standard CSV format (header row required).
2. "chart": if the command implies a visualization, return an ECharts option object; otherwise null.

The chart object, when not null, must be a valid ECharts option (e.g. include series, xAxis, yAxis, etc.). Do not add explanations or markdown, only the raw JSON.

Latest Dataset (current state):
---
${latestData}
---
Original Dataset (reference only when needed):
---
${initialData}
---
Latest Schema:
---
${sanitizedLatestSchema.join(', ') || 'None detected'}
---
Original Schema:
---
${sanitizedOriginalSchema.join(', ') || 'None detected'}
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

function normalizeSchema(schemaCandidate, csvSource) {
    if (Array.isArray(schemaCandidate) && schemaCandidate.length > 0) {
        return schemaCandidate
            .map(item => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean);
    }

    return extractHeaders(csvSource);
}

function extractHeaders(csvString) {
    if (!csvString || typeof csvString !== 'string') {
        return [];
    }

    const trimmed = csvString.trim();
    if (!trimmed) {
        return [];
    }

    const [headerLine] = trimmed.split('\n');
    if (!headerLine) {
        return [];
    }

    return headerLine
        .split(',')
        .map(header => header.trim())
        .filter(header => header.length > 0);
}