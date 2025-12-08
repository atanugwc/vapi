require('dotenv').config();

const ASSISTANT_ID = 'ff01086b-f8c3-4ef5-986e-93157b32aba5';
const TWILIO_NUMBER = ''; // must be in E.164 format like +15551234567

async function importTwilioNumber() {
  try {
    // Import Twilio number into Vapi
    const importResponse = await fetch('https://api.vapi.ai/phone-number', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_PRIVATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'twilio',
        number: TWILIO_NUMBER,
        twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
        twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
        name: 'B Dental',
        smsEnabled: false,
      }),
    });

    if (!importResponse.ok) {
      const err = await importResponse.text();
      throw new Error(`Failed to import number: ${err}`);
    }

    const importedNumber = await importResponse.json();
    console.log('✅ Number imported:', importedNumber);

    // Link number to your Vapi assistant
    const linkResponse = await fetch(`https://api.vapi.ai/phone-number/${importedNumber.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_PRIVATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId: ASSISTANT_ID,
      }),
    });

    if (!linkResponse.ok) {
      const err = await linkResponse.text();
      throw new Error(`Failed to link number: ${err}`);
    }

    const linkedNumber = await linkResponse.json();
    console.log('✅ Number linked successfully to assistant:', linkedNumber);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  }
}

importTwilioNumber();


















// require('dotenv').config();
// import fetch from 'node-fetch';

// const ASSISTANT_ID = '21985686-2101-46b1-852e-bffce3804657';

// async function buyNumberAndLink() {
//   try {
//     // Purchase number record
//     const purchaseResponse = await fetch('https://api.vapi.ai/phone-number', {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${process.env.VAPI_PRIVATE_API_KEY}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         provider: 'vapi',
//       }),
//     });

//     if (!purchaseResponse.ok) {
//       const err = await purchaseResponse.text();
//       throw new Error(`Failed to purchase number: ${err}`);
//     }

//     const purchasedNumber: any = await purchaseResponse.json();
//     console.log('Number purchased:', purchasedNumber);

//     // Link the number to the assistant
//     const linkResponse = await fetch(
//       `https://api.vapi.ai/phone-number/${purchasedNumber.id}`,
//       {
//         method: 'PATCH',
//         headers: {
//           'Authorization': `Bearer ${process.env.VAPI_PRIVATE_API_KEY}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           assistantId: ASSISTANT_ID,
//         }),
//       }
//     );

//     if (!linkResponse.ok) {
//       const err = await linkResponse.text();
//       throw new Error(`Failed to link number: ${err}`);
//     }

//     const linkedNumber: any = await linkResponse.json();
//     console.log('Number linked successfully to assistant:', linkedNumber);
//   } catch (error: any) {
//     console.error('Error:', error.message);
//   }
// }

// buyNumberAndLink();
