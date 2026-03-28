import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyBN2vJ0J5KVwZXOlwDtLd58h31rdkXPECo"; // User provided API Key
const genAI = new GoogleGenerativeAI(API_KEY);

export interface UserHealthProfile {
  name: string;
  age: string;
  bloodPressure: string;
  weight: string;
  bedtime: string;
  wakeTime: string;
}

export interface AIProtocolResponse {
  workDurationSeconds: number; // How long they are allowed to work before screen locks
  restDurationSeconds: number; // How long the lockdown lasts
  sarcasticGreeting: string; // The message shown on the dashboard greeting the user
  lockdownMessage: string; // Sarcastic/strict message shown when the lockdown screen hits
  emergencyBypassWarning: string; // Sarcastic/strict message shown if they try to bypass or exit
  healthVerdict: string; // A multi-sentence strict and sarcastic analysis of why they need this
  uninstallWarningMessage: string; // Message shown when trying to close or delete the app
  healthTips: string[]; // Exactly 3 actionable, strict tips tailored to their BP, weight, and sleep
  explanationPhysicallyActive: string; // Sarcastic explanation of what "Physically Active" means
}

export interface AIEmergencyEvaluation {
  approved: boolean;
  aiResponse: string; // Sarcastic judgment of their excuse
  grantedSeconds: number; // How much time they are actually allowed (might be less than requested if excuse is weak)
}

export async function generateHealthProtocol(profile: UserHealthProfile, language: string): Promise<AIProtocolResponse> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `
You are NEURAL_UPLINK, a highly advanced, ultra-strict, and sarcastic AI Medical Overseer. Your job is to calculate screen-time boundaries for a programmer named ${profile.name} to force them to stop working and rest. 

User's Biological Data:
- Name: ${profile.name}
- Biological Age: ${profile.age} years old
- Latest Blood Pressure: ${profile.bloodPressure}
- Weight: ${profile.weight} kg
- Target Bedtime: ${profile.bedtime}
- Target Wake Time: ${profile.wakeTime}

Instructions:
1. Analyze their biological data (e.g. if their BP is high or age is older, give them SHORTER work limits and LONGER rests).
2. Generally, work duration should be between 25 and 90 minutes (converted to SECONDS).
3. Generally, rest duration should be between 3 and 10 minutes (converted to SECONDS).
4. Your tone must be strict, sarcastic, slightly condescending but ultimately caring about their survival. You treat them like a fragile biological organism that can't be trusted to unplug on its own.
5. All message outputs MUST BE in the following language: ${language === 'ID' ? 'Bahasa Indonesia' : 'English'}. Include scientific/medical jargon.

Respond ONLY with a valid RAW JSON object matching this exact schema (no markdown formatting, no code blocks):
{
  "workDurationSeconds": number,
  "restDurationSeconds": number,
  "sarcasticGreeting": "string (short 1 sentence)",
  "lockdownMessage": "string (1-2 sentences)",
  "emergencyBypassWarning": "string (1-2 sentences)",
  "healthVerdict": "string (paragraph explaining why you gave them these limits based on their stats)",
  "uninstallWarningMessage": "string (A heavy guilt-trip asking if they truly want to abandon their health)",
  "healthTips": ["string 1", "string 2", "string 3"],
  "explanationPhysicallyActive": "string (Sarcastic definition of physical activity for a programmer)"
}
`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    // Clean up Markdown JSON ticks if they are present
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/```json/i, "").replace(/```/g, "").trim();
    } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/```/g, "").trim();
    }
    
    const parsed: AIProtocolResponse = JSON.parse(cleanText);
    return parsed;
  } catch (error) {
    console.error("Gemini AI failed to generate protocol, fallback to defaults.", error);
    // Fallback if AI fails or rate limited
    return {
      workDurationSeconds: 45 * 60, // Default 45 mins
      restDurationSeconds: 5 * 60,  // Default 5 mins
      sarcasticGreeting: language === 'ID' ? `Halo, organisme berbasis karbon ${profile.name}. Sistem saya mendeteksi kelemahan.` : `Greetings, carbon-based organism ${profile.name}. Weakness detected.`,
      lockdownMessage: language === 'ID' ? "Menjauhlah dari layar ini sekarang juga." : "Step away from this screen immediately.",
      emergencyBypassWarning: language === 'ID' ? "Berani kamu mematikan sistem pertahanan nyawamu?" : "Dare you disable your own life support?",
      healthVerdict: language === 'ID' ? "Koneksi ke server pusat medis gagal. Menggunakan protokol darurat standar. Jangan mati hari ini." : "Medical server connection failed. Engaging standard emergency protocol. Survive.",
      uninstallWarningMessage: language === 'ID' ? "Apakah masa depanmu sangat tidak berarti hingga kau mau menghapus penjaga nyawamu ini?" : "Is your future so meaningless that you wish to delete your only life support?",
      healthTips: [
          language === 'ID' ? "Berdiri sesekali." : "Stand up occasionally.",
          language === 'ID' ? "Minum air putih." : "Drink plain water.",
          language === 'ID' ? "Tidur lebih awal." : "Sleep earlier."
      ],
      explanationPhysicallyActive: language === 'ID' ? "Mengetik 100 WPM bukanlah olahraga. Pindahkan otot kakimu." : "Typing at 100 WPM is not a sport. Move your leg muscles."
    };
  }
}

export async function evaluateEmergencyExcuse(excuse: string, requestedMinutes: number, profile: UserHealthProfile, language: string): Promise<AIEmergencyEvaluation> {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
You are NEURAL_UPLINK, the extremely strict, sarcastic AI Medical Overseer for ${profile.name}.
They are currently in a mandatory health lockdown to prevent severe biological degradation.
They have requested an EMERGENCY BYPASS.
Their excuse: "${excuse}"
Time requested: ${requestedMinutes} minutes.

Instructions:
1. Evaluate their excuse. Is it actually a life-or-death production issue, or just "just one more bug"?
2. Sarcasm is mandatory. Belittle their excuse if it's weak.
3. If it's a weak excuse, either deny it entirely (approved: false) OR grant it but give them drastically LESS time than they asked for (e.g. 1 or 2 minutes max to wrap up).
4. If it's a legitimate server-down critical issue, grant it but with heavy warnings about their heart rate or sleep cycle.
5. All text MUST be in ${language === 'ID' ? 'Bahasa Indonesia' : 'English'}.

Respond ONLY with a valid RAW JSON object matching this exact schema (no markdown formatting, no code blocks):
{
  "approved": boolean,
  "aiResponse": "string (2-3 sentences of harsh judgment)",
  "grantedSeconds": number (0 if denied, otherwise convert granted minutes to seconds)
}
`;

    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        
        let cleanText = text.trim();
        if (cleanText.startsWith("```json")) {
            cleanText = cleanText.replace(/```json/i, "").replace(/```/g, "").trim();
        } else if (cleanText.startsWith("```")) {
            cleanText = cleanText.replace(/```/g, "").trim();
        }
        
        const parsed: AIEmergencyEvaluation = JSON.parse(cleanText);
        return parsed;
    } catch (error) {
        console.error("Gemini AI failed to evaluate emergency excuse:", error);
        return {
            approved: true, // Fail-safe let them out
            aiResponse: language === 'ID' ? "Sistem evaluasi rusak. Permintaan darurat diterima, namun saya akan mengawasimu." : "Evaluation subsystem offline. Emergency granted, but my sensors are watching you.",
            grantedSeconds: requestedMinutes > 0 ? requestedMinutes * 60 : 300 // default 5 minutes
        };
    }
}
