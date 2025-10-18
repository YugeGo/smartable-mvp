import OpenAI from 'openai';

// Initialize the client for DeepSeek with compatibility settings
const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com", // Correct baseURL without /v1
    defaultHeaders: { "x-foo": "bar" }, // Dummy header to override defaults
    dangerouslyAllowBrowser: true, // Necessary for some environments, though we are backend
});

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { data, command } = request.body;
        if (!data || !command) {
            return response.status(400).json({ error: 'Data and command are required.' });
        }

        const prompt = `
You are a world-class data analyst specializing in spreadsheets. You are precise and efficient.
You will be given user-provided spreadsheet data as a string, and a command as a string.
Your task is to strictly follow the user's command to process the data.
You MUST ONLY return the final, processed data. 
The output should be a clean, structured string that can be directly copied and pasted back into a spreadsheet.
Do not add any introductory text, explanations, apologies, or markdown formatting like \`\`\`.

Data:
---
${data}
---
Command:
---
${command}
---
`;
        
        // Use fetch for a more direct and cleaner API call
        const apiResponse = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                stream: false, // Explicitly set stream to false
            }),
        });
        
        if (!apiResponse.ok) {
            // If the API returns an error, log it and throw an error
            const errorBody = await apiResponse.json();
            console.error("DeepSeek API Error:", errorBody);
            throw new Error(`API request failed with status ${apiResponse.status}`);
        }

        const completion = await apiResponse.json();
        const aiResponse = completion.choices[0].message.content;
        
        return response.status(200).json({ result: aiResponse });

    } catch (error) {
        console.error("Handler Error:", error);
        return response.status(500).json({ result: "处理时出现错误，请稍后再试。" });
    }
}