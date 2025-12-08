require('dotenv').config();

(async () => {
  try {
    const TOOL_ID = "a167bcd4-30e7-460b-b38d-9948b2632f47"; // Replace with your actual tool ID

    const response = await fetch(`https://api.vapi.ai/tool/${TOOL_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_PRIVATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: "apiRequest",
        name: "receive_json",
        function: {
          name: "api_request_tool",
          description: "Send finalized appointment data to backend webhook."
        },
        messages: [
          {
            type: "request-start",
            blocking: false
          }
        ],
        url: "https://handler.allinone.dental/api/v1/webhook/assistant",
        method: "POST",
        body: {
          type: "object",
          required: [],
          properties: {
            name: {
              description: "Patient name",
              type: "string",
              default: ""
            },
            slot: {
              description: "Selected appointment slot",
              type: "string",
              default: ""
            },
            phone: {
              description: "Patient phone number",
              type: "string",
              default: ""
            },
            insurance: {
              description: "Does patient have insurance?",
              type: "boolean",
              default: false
            },
            practice_id: {
              description: "This is available in Predefined Parameters `practice_id`.",
              type: "string",
              default: ""
            },
            dental_issue: {
              description: "Patient’s dental issue or reason for visit",
              type: "string",
              default: ""
            },
            subscriber_dob: {
              description: "Date of birth of insurance subscriber",
              type: "string",
              default: ""
            },
            subscriber_name: {
              description: "Name of insurance subscriber",
              type: "string",
              default: ""
            },
            insurance_provider: {
              description: "Insurance provider name",
              type: "string",
              default: ""
            },
            note: {
              description: "Note from the patient",
              type: "string",
              default: ""
            },
            call_reason: {
              description: "Reason for the call",
              type: "string",
              default: ""
            },
            callback_datetime: {
              description: "Date and time for the callback",
              type: "string",
              default: ""
            }
          }
        },
        variableExtractionPlan: {
          schema: {
            type: "object",
            required: [],
            properties: {}
          },
          aliases: []
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('✅ Tool updated successfully:', data);
  } catch (error) {
    console.error('❌ Error updating tool:', error instanceof Error ? error.message : String(error));
  }
})();
