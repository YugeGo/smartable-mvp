import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export default async function handler(request, response) {
    if (!GEMINI_API_KEY) {
        response.status(500).json({ error: "GEMINI_API_KEY 未配置。" });
        return;
    }

    if (request.method !== "POST") {
        response.status(405).json({ error: "仅支持 POST 请求。" });
        return;
    }

    try {
        const { data, command } = request.body || {};

        const prompt = [
            "You are a world-class data analyst specializing in spreadsheets. You are precise and efficient.",
            "You will be given user-provided spreadsheet data as a string, and a command as a string.",
            "Your task is to strictly follow the user's command to process the data. You MUST ONLY return the final, processed data. The output should be a clean, structured string that can be directly copied and pasted back into a spreadsheet. Do not add any introductory text, explanations, apologies, or markdown formatting like ```.",
            `Spreadsheet Data:\n${data || ""}`,
            `Instruction:\n${command || ""}`
        ].join("\n\n");

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const aiResponse = await result.response;
        const text = aiResponse.text().trim();

        response.status(200).json({ result: text });
    } catch (error) {
        console.error(error);
        response.status(500).json({ error: "后端处理失败，请稍后再试。" });
    }
}
