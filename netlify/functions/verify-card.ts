import { GoogleGenAI, Type } from '@google/genai';
// The types below are provided by the Netlify build environment.
import type { Handler, HandlerEvent } from "@netlify/functions";

// This is the serverless function that will securely handle the API call.
const handler: Handler = async (event: HandlerEvent) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Ensure the API key is available in the server environment
  if (!process.env.API_KEY) {
    console.error("API_KEY environment variable not set in Netlify function environment.");
    return {
      statusCode: 500,
      body: JSON.stringify({
        isVerified: false,
        reason: 'Verification service is not configured correctly on the server.',
      }),
    };
  }

  try {
    const { base64Image, mimeType, patientId, expiryDate } = JSON.parse(event.body || '{}');

    // Validate that all required data was sent from the frontend
    if (!base64Image || !mimeType || !patientId || !expiryDate) {
      return {
        statusCode: 400,
        body: JSON.stringify({ isVerified: false, reason: 'Missing required verification data.' }),
      };
    }

    // Initialize the Gemini client within the secure function
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const imagePart = {
      inlineData: { data: base64Image, mimeType: mimeType },
    };

    const textPart = {
      text: `
        You are an automated verification system for the "Meet4Weed" app. Your task is to verify a Florida Office of Medical Marijuana Use (OMMU) card.
        Strictly perform the following checks:
        1. Confirm the image provided is a legitimate, unaltered Florida OMMU medical marijuana card. It should have the official state seal and layout.
        2. Verify that the "Patient ID" on the card EXACTLY matches the user-provided ID: "${patientId}".
        3. Verify that the "Expiration Date" on the card EXACTLY matches the user-provided date: "${expiryDate}".
        Based on these checks, provide a JSON response.
      `,
    };

    // Make the call to the Gemini API
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isVerified: { type: Type.BOOLEAN, description: 'True if all checks pass, otherwise false.' },
            reason: { type: Type.STRING, description: 'If verified, state "Verification successful." If not, provide a brief, clear reason for failure (e.g., "Patient ID mismatch.", "Image is not a valid FL OMMU card.", "Expiration date does not match.").' },
          },
        },
      },
    });

    // Send the successful response from Gemini back to the frontend
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: response.text,
    };

  } catch (error) {
    console.error("Error in verify-card function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        isVerified: false,
        reason: 'An unexpected error occurred during verification on the server.',
      }),
    };
  }
};

export { handler };
