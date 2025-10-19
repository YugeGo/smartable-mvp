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
        const { command, workspace: workspaceCandidate, activeTableName } = body;

        if (!command || typeof command !== 'string') {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Command is required.' })
            };
        }

        const normalizedWorkspace = normalizeWorkspace(workspaceCandidate);
        const requestedActiveName = typeof activeTableName === 'string' ? activeTableName : '';
        const resolvedActiveName = resolveActiveTableName(normalizedWorkspace, requestedActiveName);

        if (!resolvedActiveName) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Active table is required and must exist in the workspace.' })
            };
        }

        const workspacePrompt = buildWorkspacePrompt(normalizedWorkspace, resolvedActiveName);

    const prompt = `
You are a world-class data analyst specializing in spreadsheets and data visualization. You work inside a multi-table workspace.

Workspace rules:
- The workspace contains multiple named tables. Each table has an original version (initial upload) and the latest version (after prior AI steps).
- The active table is "${resolvedActiveName}". Unless the user specifies another target, operate on this table and keep its column integrity.
- You may reference any other table in the workspace when the task requires joins, lookups, or cross-table calculations.
- When you modify an existing table, do not drop columns that are present in its latest schema unless the user explicitly instructs you to do so.
- If the user asks for a new derived table, choose a concise, descriptive snake_case name and place it in the "targetTable" field of your response.
- If the user mentions a specific table name that exists in the workspace, treat that table as the command target and set "targetTable" to that name.
- When a requested field is missing from the latest version but exists in the original version of the same table, reintroduce it from the original data.
- Prefer working with the latest version to maintain continuity, and consult the original only when necessary.

Performance & limits:
- Always keep the response efficient. Prefer aggregated/summary outputs over raw detailed rows when the command is broad or expensive.
- Cap the CSV output to at most 200 data rows (excluding header). If truncation is applied, put a final row with a note like "... (truncated)" or include a short textual hint in non-CSV fields is NOT allowed; instead, keep CSV clean and concise and ensure the header row is present. If truncation is necessary, prioritize the most informative/top categories by measure.
- Avoid high-cardinality expansions and exhaustive joins. If necessary, choose the top-k categories/series.
- Choose chart types that are fast to render.

Your response MUST be a single valid JSON object with the following keys:
1. "result": string of processed data in standard CSV format (header row required). If no tabular result is appropriate, return the unchanged data of the target table.
2. "chart": if the command implies a visualization, return an ECharts option object; otherwise null.
3. "targetTable": the name of the table that should receive the result (existing or new). Default to "${resolvedActiveName}" if the user does not imply another table.

Workspace Snapshot:
${workspacePrompt}

Command:
---
${command}
---
`;

        // Timeout guard to avoid long-running requests on serverless
        const ac = new AbortController();
        const timeout = setTimeout(() => ac.abort(), 28000);

        const completion = await deepseek.chat.completions.create({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
            max_tokens: 2000,
            response_format: { type: "json_object" }
        }, { signal: ac.signal }).finally(() => clearTimeout(timeout));

        const aiResponseJsonString = completion.choices[0].message.content;
        // Enforce a hard cap on CSV rows to reduce payload and timeout downstream
        let bodyJson;
        try {
            bodyJson = JSON.parse(aiResponseJsonString);
            if (typeof bodyJson?.result === 'string') {
                const lines = bodyJson.result.split('\n');
                if (lines.length > 201) { // header + 200 rows
                    const header = lines[0];
                    const trimmed = [header, ...lines.slice(1, 201)];
                    bodyJson.result = trimmed.join('\n');
                }
            }
        } catch (_) {
            // If parse fails, just pass through the original content
            bodyJson = null;
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: bodyJson ? JSON.stringify(bodyJson) : aiResponseJsonString
        };

    } catch (error) {
        console.error("Error calling DeepSeek API:", error);
        // Surface gateway timeout to client when aborted
        if (error?.name === 'AbortError') {
            return {
                statusCode: 504,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ result: "服务响应超时，请简化指令或稍后再试。", chart: null })
            };
        }
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

function normalizeWorkspace(workspaceCandidate) {
    const normalized = {};

    if (!workspaceCandidate || typeof workspaceCandidate !== 'object') {
        return normalized;
    }

    Object.entries(workspaceCandidate).forEach(([tableName, tableValue]) => {
        if (typeof tableName !== 'string' || tableName.trim() === '') {
            return;
        }

        const currentData = typeof tableValue?.currentData === 'string' ? tableValue.currentData : '';
        const originalDataCandidate = typeof tableValue?.originalData === 'string' ? tableValue.originalData : '';
        const originalData = originalDataCandidate && originalDataCandidate.trim() !== ''
            ? originalDataCandidate
            : currentData;

        normalized[tableName] = {
            currentData,
            originalData,
            currentSchema: normalizeSchema(tableValue?.currentSchema, currentData),
            originalSchema: normalizeSchema(tableValue?.originalSchema, originalData)
        };
    });

    return normalized;
}

function resolveActiveTableName(workspaceMap, requestedName) {
    if (!requestedName) {
        return '';
    }

    if (workspaceMap[requestedName]) {
        return requestedName;
    }

    const fallback = Object.keys(workspaceMap).find(name => name.trim() === requestedName.trim());
    return fallback || '';
}

function buildWorkspacePrompt(workspaceMap, activeTableName) {
    const sections = Object.entries(workspaceMap).map(([tableName, tableValue]) => {
        const roleLabel = tableName === activeTableName
            ? 'Active table (default target)'
            : 'Auxiliary table';

        const currentSchema = tableValue.currentSchema?.join(', ') || 'None detected';
        const originalSchema = tableValue.originalSchema?.join(', ') || 'None detected';

        return `Table: ${tableName}
Role: ${roleLabel}
Current Schema: ${currentSchema}
Original Schema: ${originalSchema}
Current Data (trimmed preview):
---
${truncateCsv(tableValue.currentData)}
---
Original Data Snapshot:
---
${truncateCsv(tableValue.originalData)}
---`;
    });

    return sections.join('\n\n');
}

function truncateCsv(csvString, maxLines = 200) {
    if (!csvString || typeof csvString !== 'string') {
        return '';
    }

    const lines = csvString.split('\n');
    if (lines.length <= maxLines) {
        return csvString;
    }

    const trimmed = lines.slice(0, maxLines).join('\n');
    return `${trimmed}\n...（数据已截断，仅展示前 ${maxLines} 行）`;
}