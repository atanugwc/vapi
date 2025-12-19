const { json } = require("express")

Name                   final_json


// What is the purpose of this structured output?


Capture structured patient, appointment, insurance, and call-intent data from
voice calls so it can be stored, processed, and used for automated follow-ups.


Schema

// Type of Output          Object
Property                output
// Type                    String




Extraction Description


{"type":"object","properties":{"name":{"description":"Patient's full name, [First name] [Last name].Both First name and Last name is required. Always ensure both present in the name.","type":"string","default":""},"dob":{"description":"Patient's date of birth. Format: YYYY-MM-DD","type":"string","default":""},"is_new_patient":{"description":"Is the patient visited before?","type":"boolean","default":"true"},"slot":{"description":"Selected slot datetime for the appointment. Format: YYYY-MM-DD HH:MM:SS","type":"string","default":""},"calling_number":{"description":"This is the number the patient calling from.","type":"string","default":""},"phone":{"description":"This is the patient's other phone number used for appointment or callback.","type":"string","default":""},"practice_id":{"description":"This is available in Predefined Parameters `practice_id`.","type":"string","default":""},"identifier":{"description":"This is the unique identifier of the selected slot. It comes from the `fetch_slot` tool response and helps match which slot the caller chose.This value identifies the specific slot batch that was fetched and allows the system to match which slot the caller selects later.","type":"string","default":""},"dental_issue":{"description":"Dental issue or condition of the patient.","type":"string","default":""},"insurance":{"description":"Is the patient have insurance?","type":"boolean","default":""},"insurance_provider":{"description":"Insurance provider name.","type":"string","default":""},"subscriber_name":{"description":"Subscriber's full name.","type":"string","default":""},"subscriber_dob":{"description":"Subscriber's date of birth. Format: YYYY-MM-DD","type":"string","default":""},"subscriber_id":{"description":"Subscriber id for the insurance.","type":"string","default":""},"booking_intention":{"description":"Caller intention for the call, whether they called to book or reschedule an appointment","type":"boolean","default":""},"appointment_confirmed":{"description":"Is the appointment confirmed or booked?","type":"boolean","default":""},"note":{"description":"notes,reasons, and reminders from the patient, stored as an array of strings. Examples: ['note 1', 'reason 1', 'reminder 1', 'insurance 1', 'Other insurance provider name'].","type":"array","items":{"type":"string"},"default":[]},"task":{"type":"string","description":"any action/task asked/needed after the call (5–10 words). If no further action needed, Return empty string. never return like No further action needed.","default":""},"summary":{"type":"string","description":"Short 1-3 sentence natural-language summary of the call outcome.","default":""}},"required":["name","dob","is_new_patient","slot","calling_number","phone","practice_id","identifier","dental_issue","insurance","insurance_provider","subscriber_name","subscriber_dob","subscriber_id","booking_intention","appointment_confirmed","note","task","summary"]}


json




{
  "type": "object",
  "properties": {
    "name": {
        "description": "Patient's full name, [First name] [Last name].Both First name and Last name is required. Always ensure both present in the name.",
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
        "type": "array",
        "items": { "type": "string" },
        "default": []
      },
    "task": {
      "type": "string",
      "description": "any action/task asked/needed after the call (5–10 words). If no further action needed, Return empty string. never return like No further action needed.",
      "default": ""
    },
    "summary": {
      "type": "string",
      "description": "Short 1-3 sentence natural-language summary of the call outcome.",
      "default": ""
    }
  },
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
          "task",
          "summary"
  ]
}