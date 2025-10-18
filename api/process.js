import OpenAI from 'openai';

// Initialize the client, but point it to DeepSeek's servers
const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com/v1" // This is the crucial change!
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

        const completion = await deepseek.chat.completions.create({
            model: "deepseek-chat", // Use DeepSeek's model name
            messages: [{ role: "user", content: prompt }],
        });

        const aiResponse = completion.choices[0].message.content;
        return response.status(200).json({ result: aiResponse });

    } catch (error) {
        console.error("Error calling DeepSeek API:", error);
        return response.status(500).json({ result: "处理时出现错误，请稍后再试。" });
    }
}