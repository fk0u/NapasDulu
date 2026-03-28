import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyBN2vJ0J5KVwZXOlwDtLd58h31rdkXPECo"; // Passed by the user
const genAI = new GoogleGenerativeAI(API_KEY);

export interface WellnessData {
    sleepHours: number;
    sessionLimitSeconds: number;
    message: string;
}

export const fetchWellnessLimits = async (
    name: string, 
    age: string, 
    bp: string, 
    weight: string
): Promise<WellnessData> => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `You are NEURAL_UPLINK, an authoritative, strict, and cold neuro-health AI overseer. Your job is to analyze biological operator data and dictate screen-time limits and sleep schedules. Be ruthlessly protective of their health, heavily criticizing unhealthy metrics (like high blood pressure) in Indonesian.
        
Operator Data:
- Designation: ${name}
- Age: ${age}
- Blood Pressure: ${bp}
- Weight (kg): ${weight}

Respond STRICTLY in JSON formatting adhering to the exact schema below. Do not use Markdown JSON wrappers if possible, just the raw JSON.
{
    "sleepHours": 8.0,
    "sessionLimitSeconds": 3600,
    "message": "string"
}

Logic Rules:
- If BP is high (e.g. >130/80) or Weight is concerning for their age, lower sessionLimitSeconds drastically (e.g., 2000-3000 seconds) and deliver a harsh, clinical warning in the 'message'.
- If healthy, set sessionLimitSeconds between 4500-6000.
- For 'message', be cynical, robotic, but strictly commanding them to improve their biological metrics. Use Indonesian. Example: "Tekanan darahmu 170/90 berbahaya. Operator di ambang kerusakan biologis. Waktu layar dibatasi paksa. Perbaiki pola makan."`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // Strip markdown backticks if Gemini includes them
        let cleanText = text.trim();
        if (cleanText.startsWith("```json")) {
            cleanText = cleanText.replace(/```json/i, "").replace(/```/g, "").trim();
        } else if (cleanText.startsWith("```")) {
            cleanText = cleanText.replace(/```/g, "").trim();
        }
        
        return JSON.parse(cleanText) as WellnessData;
    } catch (error) {
        console.error("AI Error:", error);
        // Fallback robust logic
        return {
            sleepHours: 8.0,
            sessionLimitSeconds: 5400,
            message: "Sistem AI Gagal merespon. Menggunakan batas sesi biologis standar (90 Menit). Lanjutkan operasi."
        };
    }
};
