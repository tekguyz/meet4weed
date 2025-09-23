
export const verifyMedicalCardImage = async (
    base64Image: string, 
    mimeType: string,
    patientId: string, 
    expiryDate: string
): Promise<{ isVerified: boolean; reason: string }> => {
  try {
    // The fetch request points to our new, secure serverless function.
    const response = await fetch('/.netlify/functions/verify-card', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Image,
        mimeType,
        patientId,
        expiryDate,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      // Use the reason from the function's error response, or provide a generic one.
      throw new Error(result.reason || 'The verification request failed. Please try again.');
    }
    
    return result;

  } catch (error) {
    console.error("Error calling verification service:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
    return {
      isVerified: false,
      reason: errorMessage,
    };
  }
};
