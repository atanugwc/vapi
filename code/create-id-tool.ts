require('dotenv').config();

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
        name: "important_details",
        function: {
          name: "api_request_tool",
          description: "Fetch important details to be used in the conversation."
        },
        messages: [
          {
            type: "request-start",
            "blocking": false
          }
        ],
        url: "https://handler2.allinone.dental/api/v1/ai-receptionist/practice-info",
        // url: "https://api.beta-mode.com/api/v1/ai-receptionist/practice-info",
        method: "POST",
        "body": {
        "type": "object",
        "required": [
          "practice_id"
        ],
        "properties": {
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
    console.log('✅ Tool created successfully:', data);
  } catch (error) {
    console.error('❌ Error creating tool:', error instanceof Error ? error.message : String(error));
  }
})();

