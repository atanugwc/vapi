require('dotenv').config();
import fetch from 'node-fetch';

const ASSISTANT_ID = '';
const PHONE_NUMBER_ID = ''; // Your purchased number ID

async function updatePhoneNumber() {
  try {
    const updateResponse = await fetch(`https://api.vapi.ai/phone-number/${PHONE_NUMBER_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_PRIVATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId: ASSISTANT_ID, // Only this field is valid for update
      }),
    });

    if (!updateResponse.ok) {
      const err = await updateResponse.text();
      throw new Error(`Failed to update number: ${err}`);
    }

    const updatedNumber: any = await updateResponse.json();
    console.log('Number linked successfully:', updatedNumber);

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

updatePhoneNumber();
