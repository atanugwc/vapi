require('dotenv').config();
const { VapiClient } = require("@vapi-ai/server-sdk");

(async () => {
  try {
    const response = await fetch('https://api.vapi.ai/tool', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_PRIVATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: "apiRequest",
        name: "fetch_slot",
        function: {
          "name": "api_request_tool",
          "description": "Fetch available slots"
        },
        messages: [
          {
            "type": "request-start",
            "blocking": false
          }
        ],
        url: "https://handler2.allinone.dental/api/v1/appointment/ai-slots",
        // url: "https://api.beta-mode.com/api/v1/appointment/ai-slots",
        method: "POST",
        body: {
          type: "object",
          required: [
            "practice_id"
          ],
          properties: {
            "end_date": {
              "description": "End date for slot search. Format: YYYY-MM-DD",
              "type": "string",
              "default": ""
            },
            "start_date": {
              "description": "Start date for slot search. Format: YYYY-MM-DD",
              "type": "string",
              "default": ""
            },
            "practice_id": {
            "description": "This is available in Predefined Parameters `practice_id`.",
            "type": "string",
            "default": ""
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
    console.log('✅ Tool created:', data);
  } catch (error) {
    console.error('❌ Error creating tool:', error instanceof Error ? error.message : String(error));
  }
})();
