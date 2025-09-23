import { GoogleGenAI, Type } from '@google/genai';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const verifyMedicalCardImage = async (
    base64Image: string, 
    mimeType: string,
    patientId: string, 
    expiryDate: string
): Promise<{ isVerified: boolean; reason: string }> => {
  try {
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: `
        You are an automated verification system for the "Meet4Weed" app. Your task is to verify a Florida Office of Medical Marijuana Use (OMMU) card.
        
        Strictly perform the following checks:
        1.  Confirm the image provided is a legitimate, unaltered Florida OMMU medical marijuana card. It should have the official state seal and layout.
        2.  Verify that the "Patient ID" on the card EXACTLY matches the user-provided ID: "${patientId}".
        3.  Verify that the "Expiration Date" on the card EXACTLY matches the user-provided date: "${expiryDate}".
        
        Based on these checks, provide a JSON response.
      `,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isVerified: {
              type: Type.BOOLEAN,
              description: 'True if all checks pass, otherwise false.'
            },
            reason: {
              type: Type.STRING,
              description: 'If verified, state "Verification successful." If not, provide a brief, clear reason for failure (e.g., "Patient ID mismatch.", "Image is not a valid FL OMMU card.", "Expiration date does not match.").'
            },
          },
        },
      },
    });

    const jsonResponse = JSON.parse(response.text);
    return jsonResponse;

  } catch (error) {
    console.error("Error verifying medical card:", error);
    return {
      isVerified: false,
      reason: 'An unexpected error occurred during verification. Please try again later.',
    };
  }
};