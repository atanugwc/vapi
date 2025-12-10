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
        name: "send_json",
        function: {
          name: "api_request_tool",
          description: "Send finalized data to backend webhook."
        },
        messages: [
          {
            type: "request-start",
            blocking: false
          }
        ],
        url: "https://handler2.allinone.dental/api/v1/webhook/ai-appointment-book",
        // url: "https://bce188aa-bd94-4c0c-988b-ea50cff82ed5-00-3aqa6pc632wli.pike.replit.dev:5000/api/receive_booking",
        method: "POST",
        "body": {
        "type": "object",
        "required": [
          "name",
          "dob",
          "is_new_patient",
          "slot",
          "calling_number",
          "phone",
          "practice_id",
          "identifier",
          "dental_issue",
          "insurance",
          "insurance_provider",
          "subscriber_name",
          "subscriber_dob",
          "subscriber_id",
          "booking_intention",
          "appointment_confirmed",
          "note",
          "task"
        ],
        "properties": {
      "name": {
        "description": "Patient's full name, [First name] [Last name].Both First name and Last name is required.",
        "type": "string",
        "default": ""
      },
      "dob": {
        "description": "Patient's date of birth. Format: YYYY-MM-DD",
        "type": "string",
        "default": ""
      },
      "is_new_patient": {
        "description": "Is the patient visited before?",
        "type": "boolean",
        "default": "true"
      },
      "slot": {
        "description": "Selected slot datetime for the appointment. Format: YYYY-MM-DD HH:MM:SS",
        "type": "string",
        "default": ""
      },
      "calling_number": {
        "description": "This is the number the patient calling from.",
        "type": "string",
        "default": ""
      },
      "phone": {
        "description": "This is the patient's other phone number used for appointment or callback.",
        "type": "string",
        "default": ""
      },
      "practice_id": {
        "description": "This is available in Predefined Parameters `practice_id`.",
        "type": "string",
        "default": ""
      },
      "identifier": {
        "description": "This is the unique identifier of the selected slot. It comes from the `fetch_slot` tool response and helps match which slot the caller chose.This value identifies the specific slot batch that was fetched and allows the system to match which slot the caller selects later.",
        "type": "string",
        "default": ""
      },
      "dental_issue": {
        "description": "Dental issue or condition of the patient.",
        "type": "string",
        "default": ""
      },
      "insurance": {
        "description": "Is the patient have insurance?",
        "type": "boolean",
        "default": ""
      },
      "insurance_provider": {
        "description": "Insurance provider name.",
        "type": "string",
        "default": ""
      },
      "subscriber_name": {
        "description": "Subscriber's full name.",
        "type": "string",
        "default": ""
      },
      "subscriber_dob": {
        "description": "Subscriber's date of birth. Format: YYYY-MM-DD",
        "type": "string",
        "default": ""
      },
      "subscriber_id": {
        "description": "Subscriber id for the insurance.",
        "type": "string",
        "default": ""
      },
      "booking_intention": {
        "description": "Caller intention for the call, whether they called to book or reschedule an appointment",
        "type": "boolean",
        "default": ""
      },
      "appointment_confirmed": {
        "description": "Is the appointment confirmed or booked?",
        "type": "boolean",
        "default": ""
      },
      "note":{
        "description": "notes,reasons, and reminders from the patient, stored as an array of strings. Examples: ['note 1', 'reason 1', 'reminder 1', 'insurance 1', 'Other insurance provider name'].",
        "type": "string",
        "default": ""
      },
      "task":{
        "description": "any action/task asked/needed after the call",
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

