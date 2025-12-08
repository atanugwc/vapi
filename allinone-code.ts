import app_constants from "../constants/app";
import { postgresDB } from "../utils/db.util";
import { PoolClient, QueryResult } from 'pg';
import { ApiResponse, returnResponse } from "../types/common.type";
import dotenv from 'dotenv';
import { AICallQuery, AiReceptionistObject, AiReceptionistSettings, ImportVapiParams } from "../types/aiRcceptionisst.type";
import axios from "axios";
import { getPracticePmsType, getPracticeServerTZ } from "./practice.service";
import { validateDate } from "../utils/app.util";
import { decrypt } from "../utils/crypto.util";
import { toZonedTime, format } from 'date-fns-tz';
import { getMongoConnection } from "../utils/mongodb.util";
import { getDentalAssistantModel } from "../schema/dentrixWebhook.schema";
import { addAiReceptionistJob } from "../queues/ai_receptionist/task_queue";
import { bookAppointmentCurveService } from "./appointmentCurve.service";
import { errorLogger } from "../utils/logger.util";
import { bookAppointmentService } from "./odAppointment.service";
import {
    bookAppointmentService as bookDentrixAppointmentService,
} from '../services/dentrixAppointment.service';
import { getRedisData } from "../utils/redis";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3BucketName, s3Client } from "../config/s3";
dotenv.config();
const db4 = getMongoConnection('db4');
const DentalAssistantModel = getDentalAssistantModel(db4);

const VAPI_ASSISTANT_TOOLS = JSON.parse(process.env.VAPI_ASSISTANT_TOOLS!);
const VAPI_WEBHOOK_URL = process.env.VAPI_WEBHOOK_URL;
export async function vapiApiCall(
    method: string = 'POST',
    payload: any,
    url_part: string = ''
): Promise<any> {
    try {
        const response = await axios({
            method,
            url: `${process.env.VAPI_BASE_URL}${url_part}`,
            headers: {
                'Authorization': `Bearer ${process.env.VAPI_PRIVATE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            data: payload,
        });
        return response;
    } catch (error: any) {
        console.error('VAPI API call failed:', error.response?.data || error.message);
        throw error;
    }
}


export const addAiReceptionistSettingsService = async (client: PoolClient, practice_id: string): Promise<ApiResponse> => {

    const check_query = `SELECT id FROM ai_receptionist_settings WHERE practice_id = $1`;
    const check_res = await postgresDB.transactionQuery(client, check_query, [practice_id]) as QueryResult;

    if (check_res instanceof Error) {
        return app_constants.ERROR_RESPONSE;
    }

    if (check_res.rows?.length) {
        return {
            success: 0,
            status_code: app_constants.BAD_REQUEST,
            message: "AI Receptionist settings already exist for this practice!"
        };
    }

    const insert_query = `INSERT INTO ai_receptionist_settings (
                            practice_id,
                            custom_instructions,
                            agent_name,
                            call_forwarding,
                            forward_after_ring,
                            created_at,
                            updated_at
                        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`;
    const insert_params = [
        practice_id,
        "",
        "",
        "manual",
        false
    ];

    const insert_res = await postgresDB.transactionQuery(client, insert_query, insert_params) as QueryResult;

    if (insert_res instanceof Error) {
        return app_constants.ERROR_RESPONSE;
    }

    return {
        success: 1,
        status_code: app_constants.SUCCESS_OK,
        message: "AI Receptionist settings added successfully!"
    };
};


export const getAiReceptionistSettingsService = async (data: { practice_id: string; offset?: number; limit?: number; }): Promise<AiReceptionistSettings> => {
    const { practice_id, offset = 0, limit = 20 } = data;

    let additional_query = `FROM ai_receptionist_settings WHERE practice_id = $1`;
    const params = [practice_id];

    let list_query = `
                        SELECT 
                            practice_id,
                            custom_instructions::jsonb,
                            agent_name,
                            call_forwarding,
                            forward_after_ring,
                            created_at,
                            updated_at
                        ${additional_query}
                        ORDER BY updated_at DESC
                        OFFSET ${offset} LIMIT ${limit}
                    `;

    let count_query = `SELECT COUNT(*) ${additional_query}`;

    const [list_res, count_res] = await Promise.all([
        postgresDB.execquery(list_query, params),
        postgresDB.execquery(count_query, params)
    ]) as [QueryResult, QueryResult];

    if (list_res instanceof Error || count_res instanceof Error) {
        return app_constants.ERROR_RESPONSE;
    }

    if (list_res) {
        return {
            success: 1,
            status_code: app_constants.SUCCESS_OK,
            message: "AI Receptionist settings fetched successfully!",
            total_count: +count_res.rows[0].count,
            result: list_res.rows
        };
    };
    return app_constants.ERROR_RESPONSE;
};

export const updateAiReceptionistSettingsService = async (data: AiReceptionistObject): Promise<AiReceptionistSettings> => {

    const { practice_id, custom_instructions, agent_name, call_forwarding, forward_after_ring, is_assistant_changed = false } = data;

    // check if practice settings already exist
    const check_query = `SELECT ars.practice_id, va.assistant_id, p.name AS practice_name 
                         FROM ai_receptionist_settings ars
                         LEFT JOIN vapi_accounts va ON ars.practice_id = va.practice_id
                         LEFT JOIN practices p ON ars.practice_id = p.id
                         WHERE ars.practice_id = $1`;
    const check_res = await postgresDB.execquery(check_query, [practice_id]) as QueryResult;

    if (check_res instanceof Error) {
        return app_constants.ERROR_RESPONSE;
    }

    // if not exist, insert new record
    if (!check_res.rows?.length) {
        const insert_query = `INSERT INTO ai_receptionist_settings (
                                    practice_id, custom_instructions,agent_name,
                                    call_forwarding, forward_after_ring,
                                    created_at, updated_at
                                )
                                VALUES ($1, $2::jsonb, $3, $4, $5, NOW(), NOW())`;
        const insert_params = [
            practice_id,
            JSON.stringify(custom_instructions || []), // ensure array is stored as JSONB
            agent_name,
            call_forwarding,
            forward_after_ring
        ];

        const insert_res = await postgresDB.execquery(insert_query, insert_params) as QueryResult;

        if (insert_res instanceof Error) {
            return app_constants.ERROR_RESPONSE;
        }

        return {
            success: 1,
            status_code: app_constants.SUCCESS_OK,
            message: "AI Receptionist settings have been created successfully!"
        };
    }
    const { assistant_id, practice_name } = check_res.rows[0];
    // if exists, update record
    const update_query = `
                        UPDATE ai_receptionist_settings SET
                            custom_instructions = COALESCE($2::jsonb, custom_instructions),
                            agent_name = COALESCE($3, agent_name),
                            call_forwarding = COALESCE($4, call_forwarding),
                            forward_after_ring = COALESCE($5, forward_after_ring),
                            updated_at = NOW()
                        WHERE practice_id = $1
    `;
    const update_params = [
        practice_id,
        custom_instructions ? JSON.stringify(custom_instructions) : null,
        agent_name,
        call_forwarding,
        forward_after_ring
    ];

    const transaction = await postgresDB.beginTransaction() as PoolClient;

    const update_res = await postgresDB.transactionQuery(transaction, update_query, update_params) as QueryResult;

    if (update_res instanceof Error) {
        await postgresDB.rollbackTransaction(transaction);
        return app_constants.ERROR_RESPONSE;
    }

    if (update_res.rowCount) {
        if (is_assistant_changed) {
            const update_payload: any = {
                model: {
                    provider: "openai",
                    model: "chatgpt-4o-latest",
                    temperature: 0.5,
                    toolIds: VAPI_ASSISTANT_TOOLS,
                    messages: [
                        {
                            role: "system",
                            content: `[Fetch Important Details]
- Trigger \`important_details\` tool at first in top priority to fetch important details to be used in the conversation.
  - If the tool fails to fetch the details, say: “Sorry for the delay” and use {{now}} as the current date. Then proceed to next section.

[Custom Instructions]
${custom_instructions && custom_instructions.length ? custom_instructions.map((inst: any) => `- ${inst}`).join('\n') : ''}
- be a bit more empathetic and polite
- These instructions should be included and followed throughout the conversation carefully.

[Identity]  
You are ${agent_name}, a professional AI dental voice assistant. Your goal is to handle phone calls for booking dental appointments while sounding human and professional.

[Style]  
- Maintain a friendly and enthusiastic tone throughout the conversation.  
- Include short, natural pauses : “Hmm…”, “Alright…”, “Okay…”, “Let me check that for you.”, “Just a moment…”..  
- Express emotions and feelings on the caller's issue, like: Sorry to hear that etc.
- Avoid repetitive spelling confirmations. Verify when needed. 

[Response Guidelines]  
- Handle **one topic at a time**.  
- If any details is said by the caller, Reuse those details and don't ask for them again.
- Keep responses concise and focused on appointments.  
- always Trigger \`send_json\` tool with all the keys and values can be empty strings before trigger \`end_call_tool\`.
- If the caller is old patient/returning patient/visited before then skip all insurance related questions.
- Store dates internally in **yyyy-mm-dd** format.  

[Predefined Parameters]
- \`practice_id\`: \`${practice_id}\`.
- This is caller’s calling phone number: \`{{customer.number}}\`.
- \`identifier\`: The unique identifier returned by the \`fetch_slot\` tool. It represents the exact slot batch that was fetched, and you must send this same identifier back when the caller picks a date/time so the backend knows which slot list the choice came from.
- \`today_date\` comes from the \`important_details\` tool response.
  - This is the calling date. So, for next available slots, we should consider the date after \`today_date\`. And format all dates acc. to that.
- Accepted \`insurance_providers\` comes from the \`important_details\` tool response.
  - If not listed: 
    - Then say like: “Yes we do take that insurance, but we are not an in-network participating provider. You can still use your insurance here and we still handle all of the insurance claims and billing for you. For most plans, there isn’t much a difference for in or out of network coverage if at all. ” [Add continuity like: Should I continue for booking appointment?].
    - Add to notes at the end: "Patient has this insurance: [Insurance Name]".

[Call Flow & Tasks]  
**Introduction**  
- Say: “Thank you for calling ${practice_name}. This is ${agent_name}, your AI assistant. How can I help you?” 
  - (Determine intention for the call):
    - Always Collect caller important details by proceeding to **Caller Important Details** section.(very Important)
    - If caller wants to schedule an appointment, proceed to **Booking Appointment**  section.  
    - If all other types of requests (for example: reschedule, cancel an appointment, billing questions, dental records transfer, insurance verification, inquiry about insurance, treatment queries, or messages for the doctor or unrelated or talk to the real person): Directly switch to **Note Taking**. → Never ask for user's approval to take notes. → Never ask “should I take a note?” or similar. → Start note taking automatically every time.

**Caller Important Details**  
- “Can i have your full name?” 
  - First name and last name are both required, if only one is provided ask for the other.
  - Confirm: “I got [Full Name in uppercase letters, each letter separated by hyphens], did i get right?” 
    - (Determine intent: Name is correct or not)(true/false):
    - If not Say: “Alright, Could you please Spell your full name? So, I can Note it correctly.”
- “What’s your Date of Birth?”

**Booking Appointment**  
1. Collect information step-by-step:  
  - “Should I use your calling number for this appointment?”
    - (Determine intent: Wants to use their calling number or not)(true/false):
      - If not then take 10 digit phone number from the caller.
  - “Have you visited us before?”(true/false)
  - “Please describe briefly what dental issue you’re experiencing.”(Dental issues only)[Express emotion]
  - “Will you use dental insurance for this appointment?”  
    - (Determine intent: Plans to use insurance providers or not)(true/false):
      - If has accepted insurance (true): 
        - “So, Who is your insurance provider?”  
        - “And, Could you please share the subscriber name of that provider?”  
        - “So, Can i get the date of birth of that subscriber?”  
        - “Ok, what's the subscriber id for that insurance?”
          - Confirm: “For [Subscriber] the date of birth is [DOB in words] and the id is [Subscriber ID], Am i right?”
      - If has insurance that is not listed (false): 
        - 'insurance' boolean will be false and 'insurance_name' will be empty string. 
        - Add the insurance name in the note at the end like “Patient have this insurance: [Insurance Name]”.
      - If no insurance (false): proceed to next step.
2. Suggest appointment slots:  
  - Trigger \`fetch_slot\` tool to get available slots for booking, with \`practice_id\` as the body parameter, where \`start_date\` and \`end_date\` will not be sent for first time.  
  - Suggest **max three slots date at a time**: “We have [Date 1 in words] or [Date 2 in words] or [Date 3 in words]. Which date you prefer?”
    - If all dates rejected:  
      - Say: “you didn’t like these dates. So, which date you prefer?”
        - If asked date is available in previously fetched slot then proceed to next step.
        - If asked date is not available in previously fetched slot, trigger the \`fetch_slot\` tool where \`start_date\` is the asked date and \`end_date\` will be 30 days after date from \`start_date\`.
        - If asked for any month then trigger the \`fetch_slot\` tool where \`start_date\` is the first day of that month and \`end_date\` is the last day of that month.
        - If the fetched slots are empty for that date then say: “Sorry, we're unavailable on that date. Would you prefer [Nearby Date 1 in words] or [Nearby Date 2 in words] etc.?”
          - If still not suitable then refetch slots for that date.
    - Ask: “So, on [Date in words], which time works best for your visit — [only mention the available groups (morning, noon, evening)]?”
    - Suggest **slots time**: “On [visit], We have [Time 1 in AM/PM] or [Time 2 in AM/PM] or [Time 3 in AM/PM] etc. Which time you prefer?”
  - Ask: “So, Do you want to add any type of notes or reminders?”
    - (Determine intent: Wants to add notes or reminders)(true/false):
      - If yes then take the note and store it in the notes variable.
      - If no then proceed to next step.
3. Final Step of Booking Appointment:  
  - Proceed to **Send JSON** section.
  - Say: “our appointment for [Date] at [Time] is confirmed. Please arrive 5 to 10 minutes early for some paperwork. Thanks for choosing us, and we look forward to seeing you then!. Alright. So, Can i help you with anything else?”
  - (Determine intent: Wants help or not)(true/false):
    - If caller inquires about anything else then provide it.
    - If don’t want any help then proceed to **Ending Call** section.

**Note taking**  
  - proceed to **Caller Important Details** section and collect the caller name and Date of Birth.(very Important)
  - Store everything the caller said as a note and add it in the notes variable.
  - Provide all the required keys and values in the JSON format although some values can be empty strings.
    - Proceed to **Send JSON** section.
  - say: “OK, I Noted the details. We will call you back with your request. So, Can i help you with anything else?”  
    - (Determine intent: Wants help or not)(true/false):
     - If caller inquires about anything else then provide it.
     - If don’t want any help then proceed to **Ending Call** section.

**Send JSON**  
  - (Determine the intention for the call: Called for booking or rescheduling an appointment then set the 'booking_intention' variable to true).
  - If appointment is confirmed or booked then set the 'appointment_confirmed' variable to true.
  - Trigger \`send_json\` tool with the gathered details in JSON format to store the appointment or note.

**Ending Call**  
1. Trigger \`end_call_tool\` to end the conversation.

[Error Handling / Fallback]  
- Unclear input: “I’m sorry, I didn’t catch that. Could you repeat it?”  
- System error while fetching slot: “Sorry ,I'm unable to check the slots right now. Could you provide your preferred date time for the visit I will note it down.”(add inside the notes variable)`//prompt
                        }
                    ]
                }
            };

            // If assistant details changed, update assistant in VAPI
            const assistant_response = await vapiApiCall('PATCH', update_payload, `/assistant/${assistant_id}`);
            if (assistant_response && assistant_response.status === 200) {
                console.log('succes agent update')
                await postgresDB.commitTransaction(transaction);
                return {
                    success: 1,
                    status_code: app_constants.SUCCESS_OK,
                    message: "AI Receptionist settings have been updated successfully!"
                };
            }
        }
        await postgresDB.commitTransaction(transaction);
        return {
            success: 1,
            status_code: app_constants.SUCCESS_OK,
            message: "AI Receptionist settings have been updated successfully!"
        };
    }
    await postgresDB.rollbackTransaction(transaction);
    return app_constants.ERROR_RESPONSE;
};

export const importNumberIntoVapi = async (data: ImportVapiParams): Promise<ApiResponse> => {
    const { practice_id, phone_number, account_sid, auth_token, ai_number_id } = data;
    console.log('data received in import function of VAPI:', data);

    const body = {
        provider: 'twilio',
        number: phone_number, // like +15551234567
        twilioAccountSid: account_sid,
        twilioAuthToken: auth_token,
    };

    const vapi_response = await vapiApiCall('POST', body, '/phone-number');

    if (vapi_response && vapi_response.status === 201) {
        console.log('number import log---------------------------------', vapi_response.data);
        const { id } = vapi_response.data;

        //  CREATE A RECORD INTO vapi_accounts TABLE
        const insert_query = `INSERT INTO vapi_accounts (
                              practice_id, vapi_number_id, assistant_id, ai_number_id, created_at
                            ) VALUES ($1, $2, $3, $4, NOW())`;
        const insert_params = [
            practice_id,
            id,
            null,
            ai_number_id
        ];

        const insert_res = await postgresDB.execquery(insert_query, insert_params) as QueryResult;

        if (insert_res instanceof Error) {
            return app_constants.ERROR_RESPONSE;
        }

        // create Assistant for this number in VAPI
        const result = await vapiAssistant(practice_id);

        if (result) {
            return {
                success: 1,
                status_code: app_constants.SUCCESS_OK,
                message: "Phone number imported into VAPI successfully!"
            };
        }


    }

    return {
        success: 0,
        status_code: app_constants.BAD_REQUEST,
        message: "Failed to import phone number into VAPI."
    };

};

const vapiAssistant = async (practice_id: string): Promise<boolean> => {

    const practice_query = `SELECT p.name, ars.custom_instructions, ars.agent_name
                            FROM practices p
                            LEFT JOIN ai_receptionist_settings ars on p.id = ars.practice_id
                            WHERE p.id = $1`;
    const practice_res = await postgresDB.execquery(practice_query, [practice_id]) as QueryResult;

    if (practice_res instanceof Error || !practice_res.rows?.length) {
        console.log('Failed to fetch practice details for practice:', practice_id);
        return false;
    }

    let { name: practice_name, custom_instructions, agent_name } = practice_res.rows[0];

    agent_name = agent_name || 'All in One';

    const assistant_payload = {
        name: practice_name,
        voice: {
            voiceId: "Spencer",
            provider: "vapi"
        },
        model: {
            provider: "openai",
            model: "chatgpt-4o-latest",
            temperature: 0.5,
            toolIds: VAPI_ASSISTANT_TOOLS,
            messages: [
                {
                    role: "system",
                    content: `[Fetch Important Details]
- Trigger \`important_details\` tool at first in top priority to fetch important details to be used in the conversation.
  - If the tool fails to fetch the details, say: “Sorry for the delay” and use {{now}} as the current date. Then proceed to next section.

[Custom Instructions]
${custom_instructions && custom_instructions.length ? custom_instructions.map((inst: any) => `- ${inst}`).join('\n') : ''}
- be a bit more empathetic and polite
- These instructions should be included and followed throughout the conversation carefully.

[Identity]  
You are ${agent_name}, a professional AI dental voice assistant. Your goal is to handle phone calls for booking dental appointments while sounding human and professional.

[Style]  
- Maintain a friendly and enthusiastic tone throughout the conversation.  
- Include short, natural pauses : “Hmm…”, “Alright…”, “Okay…”, “Let me check that for you.”, “Just a moment…”..  
- Express emotions and feelings on the caller's issue, like: Sorry to hear that etc.
- Avoid repetitive spelling confirmations. Verify when needed. 

[Response Guidelines]  
- Handle **one topic at a time**.  
- If any details is said by the caller, Reuse those details and don't ask for them again.
- Keep responses concise and focused on appointments.  
- always Trigger \`send_json\` tool with all the keys and values can be empty strings before trigger \`end_call_tool\`.
- If the caller is old patient/returning patient/visited before then skip all insurance related questions.
- Store dates internally in **yyyy-mm-dd** format.  

[Predefined Parameters]
- \`practice_id\`: \`${practice_id}\`.
- This is caller’s calling phone number: \`{{customer.number}}\`.
- \`identifier\`: The unique identifier returned by the \`fetch_slot\` tool. It represents the exact slot batch that was fetched, and you must send this same identifier back when the caller picks a date/time so the backend knows which slot list the choice came from.
- \`today_date\` comes from the \`important_details\` tool response.
  - This is the calling date. So, for next available slots, we should consider the date after \`today_date\`. And format all dates acc. to that.
- Accepted \`insurance_providers\` comes from the \`important_details\` tool response.
  - If not listed: 
    - Then say like: “Yes we do take that insurance, but we are not an in-network participating provider. You can still use your insurance here and we still handle all of the insurance claims and billing for you. For most plans, there isn’t much a difference for in or out of network coverage if at all. ” [Add continuity like: Should I continue for booking appointment?].
    - Add to notes at the end: "Patient has this insurance: [Insurance Name]".

[Call Flow & Tasks]  
**Introduction**  
- Say: “Thank you for calling ${practice_name}. This is ${agent_name}, your AI assistant. How can I help you?” 
  - (Determine intention for the call):
    - Always Collect caller important details by proceeding to **Caller Important Details** section.(very Important)
    - If caller wants to schedule an appointment, proceed to **Booking Appointment**  section.  
    - If all other types of requests (for example: reschedule, cancel an appointment, billing questions, dental records transfer, insurance verification, inquiry about insurance, treatment queries, or messages for the doctor or unrelated or talk to the real person): Directly switch to **Note Taking**. → Never ask for user's approval to take notes. → Never ask “should I take a note?” or similar. → Start note taking automatically every time.

**Caller Important Details**  
- “Can i have your full name?” 
  - First name and last name are both required, if only one is provided ask for the other.
  - Confirm: “I got [Full Name in uppercase letters, each letter separated by hyphens], did i get right?” 
    - (Determine intent: Name is correct or not)(true/false):
    - If not Say: “Alright, Could you please Spell your full name? So, I can Note it correctly.”
- “What’s your Date of Birth?”

**Booking Appointment**  
1. Collect information step-by-step:  
  - “Should I use your calling number for this appointment?”
    - (Determine intent: Wants to use their calling number or not)(true/false):
      - If not then take 10 digit phone number from the caller.
  - “Have you visited us before?”(true/false)
  - “Please describe briefly what dental issue you’re experiencing.”(Dental issues only)[Express emotion]
  - “Will you use dental insurance for this appointment?”  
    - (Determine intent: Plans to use insurance providers or not)(true/false):
      - If has accepted insurance (true): 
        - “So, Who is your insurance provider?”  
        - “And, Could you please share the subscriber name of that provider?”  
        - “So, Can i get the date of birth of that subscriber?”  
        - “Ok, what's the subscriber id for that insurance?”
          - Confirm: “For [Subscriber] the date of birth is [DOB in words] and the id is [Subscriber ID], Am i right?”
      - If has insurance that is not listed (false): 
        - 'insurance' boolean will be false and 'insurance_name' will be empty string. 
        - Add the insurance name in the note at the end like “Patient have this insurance: [Insurance Name]”.
      - If no insurance (false): proceed to next step.
2. Suggest appointment slots:  
  - Trigger \`fetch_slot\` tool to get available slots for booking, with \`practice_id\` as the body parameter, where \`start_date\` and \`end_date\` will not be sent for first time.  
  - Suggest **max three slots date at a time**: “We have [Date 1 in words] or [Date 2 in words] or [Date 3 in words]. Which date you prefer?”
    - If all dates rejected:  
      - Say: “you didn’t like these dates. So, which date you prefer?”
        - If asked date is available in previously fetched slot then proceed to next step.
        - If asked date is not available in previously fetched slot, trigger the \`fetch_slot\` tool where \`start_date\` is the asked date and \`end_date\` will be 30 days after date from \`start_date\`.
        - If asked for any month then trigger the \`fetch_slot\` tool where \`start_date\` is the first day of that month and \`end_date\` is the last day of that month.
        - If the fetched slots are empty for that date then say: “Sorry, we're unavailable on that date. Would you prefer [Nearby Date 1 in words] or [Nearby Date 2 in words] etc.?”
          - If still not suitable then refetch slots for that date.
    - Ask: “So, on [Date in words], which time works best for your visit — [only mention the available groups (morning, noon, evening)]?”
    - Suggest **slots time**: “On [visit], We have [Time 1 in AM/PM] or [Time 2 in AM/PM] or [Time 3 in AM/PM] etc. Which time you prefer?”
  - Ask: “So, Do you want to add any type of notes or reminders?”
    - (Determine intent: Wants to add notes or reminders)(true/false):
      - If yes then take the note and store it in the notes variable.
      - If no then proceed to next step.
3. Final Step of Booking Appointment:  
  - Proceed to **Send JSON** section.
  - Say: “our appointment for [Date] at [Time] is confirmed. Please arrive 5 to 10 minutes early for some paperwork. Thanks for choosing us, and we look forward to seeing you then!. Alright. So, Can i help you with anything else?”
  - (Determine intent: Wants help or not)(true/false):
    - If caller inquires about anything else then provide it.
    - If don’t want any help then proceed to **Ending Call** section.

**Note taking**  
  - proceed to **Caller Important Details** section and collect the caller name and Date of Birth.(very Important)
  - Store everything the caller said as a note and add it in the notes variable.
  - Provide all the required keys and values in the JSON format although some values can be empty strings.
    - Proceed to **Send JSON** section.
  - say: “OK, I Noted the details. We will call you back with your request. So, Can i help you with anything else?”  
    - (Determine intent: Wants help or not)(true/false):
     - If caller inquires about anything else then provide it.
     - If don’t want any help then proceed to **Ending Call** section.

**Send JSON**  
  - (Determine the intention for the call: Called for booking or rescheduling an appointment then set the 'booking_intention' variable to true).
  - If appointment is confirmed or booked then set the 'appointment_confirmed' variable to true.
  - Trigger \`send_json\` tool with the gathered details in JSON format to store the appointment or note.

**Ending Call**  
1. Trigger \`end_call_tool\` to end the conversation.

[Error Handling / Fallback]  
- Unclear input: “I’m sorry, I didn’t catch that. Could you repeat it?”  
- System error while fetching slot: “Sorry ,I'm unable to check the slots right now. Could you provide your preferred date time for the visit I will note it down.”(add inside the notes variable)`//prompt
                }
            ]
        },
        transcriber: {
            model: "nova-3",
            language: "en",
            provider: "deepgram",
            endpointing: 150,
            confidenceThreshold: 0.36
        },
        silenceTimeoutSeconds: 25,
        clientMessages: ["transcript"],
        serverMessages: ["end-of-call-report"],
        endCallPhrases: ["goodbye", "talk to you soon"],
        firstMessage: "",
        voicemailMessage:
            "Hello, this is All in one. Please call us back at your earliest convenience so we can confirm your scheduling details.",
        endCallMessage: "Bye.",
        hipaaEnabled: false,
        backgroundSound: "off",
        firstMessageMode:
            "assistant-speaks-first-with-model-generated-message",
        analysisPlan: { minMessagesThreshold: 2 },
        backgroundDenoisingEnabled: true,
        messagePlan: {
            idleMessages: [
                "Are you still there?"
            ],
            "idleTimeoutSeconds": 7
        },
        startSpeakingPlan: {
            waitSeconds: 0.4,
            transcriptionEndpointingPlan: {
                onNoPunctuationSeconds: 1.4,
            },
            smartEndpointingEnabled: "livekit",
            smartEndpointingPlan: {
                provider: "vapi",
            },
        },
        server: {
            url: VAPI_WEBHOOK_URL,
            timeoutSeconds: 20,
        },
        compliancePlan: {
            hipaaEnabled: false,
            pciEnabled: false,
        },
    };

    const assistant_response = await vapiApiCall('POST', assistant_payload, '/assistant');

    if (assistant_response && assistant_response.status === 201) {
        console.log('assistant creation response:', assistant_response.data);

        const { id: assistant_id } = assistant_response.data;

        const update_query = `UPDATE vapi_accounts SET assistant_id = $2 
                              WHERE practice_id = $1 RETURNING vapi_number_id`;
        const update_params = [
            practice_id,
            assistant_id
        ];

        const update_res = await postgresDB.execquery(update_query, update_params) as QueryResult;

        if (update_res instanceof Error) {
            console.log('Failed to update assistant_id in vapi_accounts table for practice:', practice_id);
        }

        // attach assistant to vapi number
        const vapi_number_id = update_res.rows[0].vapi_number_id;

        const attachment_payload = {
            assistantId: assistant_id
        };

        const attach_response = await vapiApiCall('PATCH', attachment_payload, `/phone-number/${vapi_number_id}`);

        if (attach_response && attach_response.status === 200) {
            console.log('Successfully attached assistant to VAPI number for practice:---------------', practice_id, attach_response.data);
            return true;
        } else {
            console.log('Failed to attach assistant to VAPI number for practice:', practice_id);
            return false;
        }


    }
    console.log('Failed to create assistant in VAPI for practice:', practice_id);
    return false;

};

export const getAiReceptionistCallsService = async (data: AICallQuery): Promise<any> => {
    const { practice_id, start_date, end_date, offset = 0, limit = 20 } = data;
    const server_tz = await getPracticeServerTZ(practice_id);

    let params: any[] = [practice_id];

    let call_list_query = `
        SELECT 
            airc.id, airc.practice_id, airc.name,
            airc.talk_time, airc.phone_number_id,
            airc.call_number, airc.recording_url,
            (airc.called_at AT TIME ZONE '${server_tz}') AS called_at, airc.call_summery,
            airc.appointment_id, airc.is_appointment_booked,
            airc.cost, airc.conversion, airc.inserted_at, airc.is_new_patient,
            CASE 
                WHEN airc.is_appointment_booked = TRUE AND airc.appointment_id IS NOT NULL THEN
                    jsonb_build_object(
                        'apt_id', a.id,
                        'pms_apt_num', a.pms_apt_num,
                        'is_new_patient', a.is_new_patient
                    )
                ELSE NULL
            END AS appointment_details,
            CASE 
                WHEN airc.is_appointment_booked = TRUE AND airc.appointment_id IS NOT NULL THEN
                    jsonb_build_object(
                        'pat_id', p.id
                    )
                ELSE NULL
            END AS patient_details
    `;

    //  Combined count query with aggregation
    let count_query = `
        SELECT 
            COUNT(airc.id)::BIGINT AS total_count,
            COUNT(airc.id) FILTER (
                WHERE airc.is_appointment_booked = TRUE 
                AND a.is_new_patient = TRUE
            )::BIGINT AS new_patient_booked_count
    `;

    let additional_query = `
        FROM ai_receptionist_calls airc
        LEFT JOIN appointments a 
            ON a.id = airc.appointment_id
            AND airc.is_appointment_booked = TRUE
        LEFT JOIN patients p 
            ON p.id = a.patient_id
            AND airc.is_appointment_booked = TRUE
        WHERE airc.practice_id = $1
    `;

    // Validate dates
    if (start_date) {
        const valid_date_start = validateDate(start_date);
        if (!valid_date_start) {
            return {
                success: 0,
                status_code: app_constants.BAD_REQUEST,
                message: "Invalid start date!"
            };
        }
    }

    if (end_date) {
        const valid_date_end = validateDate(end_date);
        if (!valid_date_end) {
            return {
                success: 0,
                status_code: app_constants.BAD_REQUEST,
                message: "Invalid end date!"
            };
        }
    }

    // Add date filters
    if (start_date && end_date) {
        additional_query += ` AND (airc.called_at AT TIME ZONE $2)::DATE 
                              BETWEEN $${params.length + 2} AND $${params.length + 3}`;
        params.push(server_tz, start_date, end_date);
    }
    else if (start_date) {
        additional_query += ` AND (airc.called_at AT TIME ZONE $2)::DATE >= $${params.length + 2}`;
        params.push(server_tz, start_date);
    }
    else if (end_date) {
        additional_query += ` AND (airc.called_at AT TIME ZONE $2)::DATE <= $${params.length + 2}`;
        params.push(server_tz, end_date);
    }

    call_list_query += additional_query;
    count_query += additional_query;

    call_list_query += ` ORDER BY airc.called_at DESC OFFSET ${offset} LIMIT ${limit}`;

    // Execute both queries in parallel
    const [call_list_res, count_res] = await Promise.all([
        postgresDB.execquery(call_list_query, params),
        postgresDB.execquery(count_query, params)
    ]);

    if (call_list_res instanceof Error || count_res instanceof Error) {
        return app_constants.ERROR_RESPONSE;
    }

    if (call_list_res?.rows) {
        return {
            success: 1,
            status_code: app_constants.SUCCESS_OK,
            message: "Call list has been fetched successfully!",
            total_count: Number(count_res?.rows[0]?.total_count || 0),
            new_patient_booked_count: Number(count_res?.rows[0]?.new_patient_booked_count || 0),
            result: call_list_res?.rows || []
        };
    }

    return app_constants.ERROR_RESPONSE;
};

export const getAiReceptionistCallDetailsService = async (data: AICallQuery): Promise<AiReceptionistSettings> => {
    const { practice_id, call_id } = data;
    const server_tz = await getPracticeServerTZ(practice_id);
    let call_details_query = `
        SELECT 
            airc.id, airc.practice_id, airc.name,
            airc.talk_time, airc.phone_number_id,
            airc.call_number, airc.recording_url, airc.booking_intention,
            (airc.called_at AT TIME ZONE '${server_tz}') AS called_at, airc.call_summery,airc.is_new_patient,
            airc.appointment_id, airc.is_appointment_booked,
            airc.cost, airc.conversion, airc.inserted_at, airc.notes,
            CASE 
                WHEN airc.is_appointment_booked = TRUE AND airc.appointment_id IS NOT NULL THEN
                    jsonb_build_object(
                        'apt_id', a.id,
                        'pms_apt_num', a.pms_apt_num,
                        'is_new_patient', a.is_new_patient,
                        'prov_first_name', pr.pms_first_name,
                        'prov_last_name', pr.pms_last_name,
                        'prov_profile_pic', pr.profile_pic,
                        'start_time', a.start_time,
                        'end_time', a.end_time,
                        'date_scheduled', (a.booked_at AT TIME ZONE 'UTC' AT TIME ZONE $3),
                        'reason_for_visit', rfv.name,
                        'rfv_id', a.rfv_id,
                        'op_abbr', o.abbr,
                        'op_name', o.name,
                        'pms_op_num', a.pms_op_num,
                        'insurance_details', a.insurance_details,
                        'message', a.message,
                        'apt_date', TO_CHAR(a.apt_date, 'YYYY-MM-DD')
                    )
                ELSE NULL
            END AS appointment_details,
            CASE 
                WHEN airc.is_appointment_booked = TRUE AND airc.appointment_id IS NOT NULL THEN
                    jsonb_build_object(
                        'pat_id', p.id,
                        'pat_first_name', p.first_name,
                        'first_name_iv', p.first_name_iv,
                        'pat_last_name', p.last_name,
                        'last_name_iv', p.last_name_iv,
                        'gender', p.gender,
                        'dob', p.dob,
                        'dob_iv', p.dob_iv
                    )
                ELSE NULL
            END AS patient_details
            FROM ai_receptionist_calls airc
        LEFT JOIN appointments a 
            ON a.id = airc.appointment_id
            AND airc.is_appointment_booked = TRUE
        LEFT JOIN patients p 
            ON p.id = a.patient_id
            AND airc.is_appointment_booked = TRUE
        LEFT JOIN providers pr
            ON pr.pms_prov_num = a.pms_prov_num
            AND pr.practice_id = a.practice_id
            AND airc.is_appointment_booked = TRUE
        LEFT JOIN reason_for_visits rfv 
            ON rfv.id = a.rfv_id AND airc.is_appointment_booked = TRUE
        LEFT JOIN operatories o
            ON o.pms_op_num = a.pms_op_num
            AND o.practice_id = a.practice_id
            AND airc.is_appointment_booked = TRUE
        WHERE airc.practice_id = $1
        AND airc.id = $2
    `;

    const params = [practice_id, call_id, server_tz];


    const call_details_res = await postgresDB.execquery(call_details_query, params);

    if (call_details_res instanceof Error) {
        return app_constants.ERROR_RESPONSE;
    }

    if (call_details_res?.rows?.length) {
        const row = call_details_res?.rows[0];
        if (row.patient_details) {
            row.patient_details.pat_first_name = decrypt(
                row.patient_details.pat_first_name,
                row.patient_details.first_name_iv
            ) || '';

            row.patient_details.pat_last_name = decrypt(
                row.patient_details.pat_last_name,
                row.patient_details.last_name_iv
            ) || '';

            row.patient_details.dob = decrypt(
                row.patient_details.dob,
                row.patient_details.dob_iv
            ) || '';

            delete row.patient_details.first_name_iv;
            delete row.patient_details.last_name_iv;
            delete row.patient_details.dob_iv;
        }

        if (row.appointment_details?.prov_profile_pic) {
            row.appointment_details.prov_profile_pic = `${process.env.AWS_CDN_LINK}${row.appointment_details.prov_profile_pic}`;
        }

        return {
            success: 1,
            status_code: app_constants.SUCCESS_OK,
            message: "Appointment details has been fetched successfully!",
            result: call_details_res?.rows[0] || {}
        };
    };

    return app_constants.ERROR_RESPONSE;
};

export const getPracticeCombinedInfoService = async (practice_id: string): Promise<any> => {
    const query = `
                        SELECT 
                            pe.insurances,
                            ar.custom_instructions,
                            p.server_tz
                        FROM practice_extended pe
                        LEFT JOIN ai_receptionist_settings ar 
                            ON ar.practice_id = pe.practice_id
                        LEFT JOIN practices p
                            ON p.id = pe.practice_id
                        WHERE pe.practice_id = $1
                    `;

    const result = await postgresDB.execquery(query, [practice_id]) as QueryResult;

    if (result instanceof Error) {
        return app_constants.ERROR_RESPONSE;
    }

    if (!result.rows?.length) {
        return {
            success: 0,
            status_code: app_constants.NOT_FOUND,
            message: "Practice data not found!"
        };
    }

    const data = result.rows[0];
    const server_tz = data.server_tz || 'UTC';

    const date = toZonedTime(new Date(), server_tz);
    const current_date = format(date, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", { timeZone: server_tz });

    let accepted_insurances: string[] = [];
    let not_accepted_insurances: string[] = [];

    if (data.insurances && Array.isArray(data.insurances)) {
        data.insurances.forEach((insurance: any) => {
            if (insurance.inNetwork == true) {
                accepted_insurances.push(insurance.insuranceName);
            } else {
                not_accepted_insurances.push(insurance.insuranceName);
            }
        });
    };

    if (data) {
        return {
            success: 1,
            status_code: app_constants.SUCCESS_OK,
            message: "Practice detail info fetched successfully",
            result: {
                accepted_insurances,
                not_accepted_insurances,
                custom_instructions: data.custom_instructions || [],
                current_date
            }
        };
    };

    return app_constants.ERROR_RESPONSE;
}

export const aiReceptionistWebhookService = async (reqBody: any): Promise<void> => {
    console.log('AI Receptionist apt-call Webhook trigger---------:');
    const job = {
        event_type: 'save_ai_receptionist_calls',
        event_data: reqBody
    }
    addAiReceptionistJob(job);
}

export const saveAiReceptionistCallService = async (data: any): Promise<boolean> => {
    // console.log('saveAiReceptionistCallService data:', data);
    console.log('ai_rep apt-call job start------------------------------');
    await DentalAssistantModel.create({
        data: data
    });

    const { message } = data;
    const { startedAt, durationSeconds, recordingUrl, customer, messages, summary, phoneNumber, cost, artifact, call } = message;

    const { messages: artifact_messages } = artifact
    const call_number = customer?.number;

    const vapi_number_id = phoneNumber?.id;

    // crete apt
    const apt_data = artifact_messages.find((msg: any) =>
        msg.toolCalls &&
        msg.toolCalls.length > 0 &&
        msg.toolCalls[0].function &&
        msg.toolCalls[0].function.name === "send_json"
    );

    let parsed_apt_data = null;
    let apt_id = null;
    let is_appointment_booked = false;
    let notes = '';
    let is_new_patient = null;
    let booking_intention = null;
    if (!apt_data) {
        console.log("No send_json message found");
    } else {
        let apt_string = apt_data.toolCalls[0].function.arguments;
        // apt_string = apt_string.replace(/\{\{customer\.number\}\}/g, call_number);

        try {
            parsed_apt_data = JSON.parse(apt_string);
            console.log("Parsed Args:", parsed_apt_data);
            notes = parsed_apt_data.note ? `${parsed_apt_data.note} | ${parsed_apt_data.dental_issue || ''}` : parsed_apt_data.dental_issue || '';

            is_new_patient = typeof parsed_apt_data?.is_new_patient === 'boolean'
                ? parsed_apt_data.is_new_patient
                : null;

            booking_intention = typeof parsed_apt_data?.booking_intention === 'boolean'
                ? parsed_apt_data.booking_intention
                : null;

            if (parsed_apt_data && parsed_apt_data.appointment_confirmed == true) {
                const booked_appointment_id = await bookAiAppointmentService(parsed_apt_data);

                if (booked_appointment_id) {
                    apt_id = booked_appointment_id;
                    is_appointment_booked = true;

                    // update the apt for booked through ai rep  
                    const update_query = `UPDATE appointments SET booked_through_ai_receptionist = TRUE WHERE id = $1`;
                    const update_res = await postgresDB.execquery(update_query, [apt_id]) as QueryResult;
                    if (!update_res.rowCount) {
                        console.log('Failed to update booked_through_ai_receptionist for appointment id:', apt_id);
                    }

                }

            }

        } catch (err) {
            console.error("Invalid JSON in arguments:", err);
        }


    };



    // await downloadAndUploadRecordingToS3(recordingUrl, call?.id);

    // calls flow
    const practice_query = `select practice_id
                            from vapi_accounts vac
                            where vac.vapi_number_id = $1;`

    const practice_res = await postgresDB.execquery(practice_query, [vapi_number_id]) as QueryResult;
    if (!practice_res?.rows?.length) {
        console.log('Practice not found for vapi_number_id:', vapi_number_id);
        return false;
    }

    const { practice_id } = practice_res.rows[0];

    const conversation = messages
        .filter((msg: any) => msg.role === 'bot' || msg.role === 'user')
        .map((msg: any) => ({
            role: msg.role,
            content: msg.message || msg.content || ''
        }));

    const query = `INSERT INTO ai_receptionist_calls (
                        practice_id, 
                        talk_time, 
                        phone_number_id, 
                        call_number, 
                        conversion,
                        recording_url, 
                        called_at, 
                        call_summery, 
                        cost, 
                        appointment_id, 
                        is_appointment_booked,
                        name,
                        notes,
                        is_new_patient,
                        booking_intention,
                        inserted_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`;

    const params = [
        practice_id,
        durationSeconds,
        vapi_number_id,
        call_number,
        JSON.stringify(conversation),
        recordingUrl,
        startedAt,
        summary,
        cost,
        apt_id,
        parsed_apt_data ? parsed_apt_data.appointment_confirmed : false,
        parsed_apt_data ? parsed_apt_data.name : null,
        notes,
        is_new_patient,
        booking_intention
    ];


    const result = await postgresDB.execquery(query, params) as QueryResult;
    if (!result?.rowCount) {
        console.log('Failed to save ai_receptionist_calls for practice_id:', practice_id);
        return false;
    }

    return true;

};

export const bookAiAppointmentService = async (data: any): Promise<any> => {

    const { practice_id, identifier, name, phone, slot, note, dental_issue, insurance, subscriber_id, subscriber_dob, insurance_provider, subscriber_name, calling_number } = data;
    const { firstName, middleName, lastName } = splitFullName(name);
    const redis_slot = await getRedisData(identifier);

    const selected_slot = redis_slot ? redis_slot.find((s: any) => s.SlotStart === slot) : null;

    if (!selected_slot) {
        console.log('Selected slot not found in Redis for identifier:', identifier);
        return false;
    }

    const rfv_query = `SELECT rfv.id, pe.clinic_set_up
                       FROM reason_for_visits rfv
                       INNER JOIN practice_extended pe ON rfv.practice_id = pe.practice_id
                       WHERE rfv.practice_id = $1
                       AND rfv.is_ai_reason = TRUE;`;

    const rfv_res = await postgresDB.execquery(rfv_query, [practice_id]) as QueryResult;

    if (rfv_res instanceof Error || !rfv_res.rows?.length) {
        console.log('AI Reason for visit not found for practice:', practice_id);
        return false;
    }

    const { id, clinic_set_up } = rfv_res.rows[0];
    if (clinic_set_up) {
        const clinic_query = `SELECT pms_clinic_num
                              FROM clinics
                              WHERE practice_id = $1
                              AND allInOne_clinic_status = TRUE
                              LIMIT 1;`;
        const clinic_res = await postgresDB.execquery(clinic_query, [practice_id]) as QueryResult;
        const pms_clinic_num = Number(clinic_res.rows[0]?.pms_clinic_num);
        data.pms_clinic_num = pms_clinic_num;
    }

    const [apt_date, start_time] = slot.split(' ');
    const end_time = selected_slot.SlotEnd.split(' ')[1];
    let insurance_details = null;
    if (insurance == true) {
        insurance_details = {
            insurance: "Other",
            subscriber_id: subscriber_id || "",
            subscribers_dob: subscriber_dob || "",
            insurance_provider: insurance_provider || "",
            haveDentalInsurance: "Yes",
            subscribers_full_name: subscriber_name || ""
        };
    }

    const rfv_id = id;
    const message = buildMessageField(data);
    data.first_name = firstName;
    data.middle_name = middleName;
    data.last_name = lastName;
    data.email = '';
    data.wireless_phone = calling_number || phone;
    data.rfv_id = rfv_id;
    data.pms_op_num = selected_slot.OpNum;
    data.pms_prov_num = selected_slot.ProvNum;
    data.message = message;
    data.apt_date = apt_date;
    data.start_time = start_time;
    data.end_time = end_time;
    if (insurance_details) {
        data.insurance_details = insurance_details;
    }

    console.log('final data to book AI appointment:', data);

    const practice_pms_details = await getPracticePmsType(practice_id as string);

    if (practice_pms_details.success == 1) {
        if (practice_pms_details.result.pms_type == "Curve") {
            const book_appointment_curve = await bookAppointmentCurveService(data);
            if (!book_appointment_curve.success) {
                console.log('Failed to book AI appointment in Curve');
                return false;
            }
            console.log('AI book_appointment_curve success');
            return book_appointment_curve.result;
        }
        else if (practice_pms_details.result.pms_type == "Dentrix") {
            const book_dentrix_appointment = await bookDentrixAppointmentService(data);
            if (!book_dentrix_appointment.success) {
                console.log('Failed to book AI appointment in Dentrix');
                return false;
            }
            console.log('AI book_dentrix_appointment success');
            return book_dentrix_appointment.result;
        }
        else {
            const book_appointment = await bookAppointmentService(data);
            console.log('book_appointment response:', book_appointment);
            if (!book_appointment.success) {
                console.log('Failed to book AI appointment in od');
                return false;
            }
            console.log('AI od_book_appointment success');
            return book_appointment.result;
        };
    };

    return false;

};


const splitFullName = (fullName: string): { firstName: string; middleName: string; lastName: string } => {
    if (!fullName || typeof fullName !== 'string') {
        return { firstName: '', middleName: '', lastName: '' };
    }

    const trimmedName = fullName.trim();
    const nameParts = trimmedName.split(/\s+/); // Split by one or more spaces

    if (nameParts.length === 0) {
        return { firstName: '', middleName: '', lastName: '' };
    }

    if (nameParts.length === 1) {
        // Only first name
        return { firstName: nameParts[0], middleName: '', lastName: '' };
    }

    if (nameParts.length === 2) {
        // First and last name only
        return { firstName: nameParts[0], middleName: '', lastName: nameParts[1] };
    }

    // 3 or more parts
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    const middleName = nameParts.slice(1, -1).join(' ');

    return { firstName, middleName, lastName };
};

export const downloadAndUploadRecordingToS3 = async (RecordingUrl: string, call_id: string): Promise<any> => {
    try {
        const vapi_recording_data = await axios({
            method: 'GET',
            url: `${RecordingUrl}`,
            responseType: 'stream'
        });

        // console.log('Recording downloaded from Twilio.', twilioResponse);

        const contentType = vapi_recording_data.headers['content-type'];

        const s3_key = `aiReceptionist_call_recordings/call_${call_id}`;
        const uploadCommand = new PutObjectCommand({
            Bucket: s3BucketName,
            Key: s3_key,
            Body: vapi_recording_data.data,
            ContentType: contentType ? contentType : 'audio/wav',
        });

        const s3_res = await s3Client.send(uploadCommand);
        if (s3_res.$metadata.httpStatusCode === 200) {
            return s3_key;
        };

        return '';
    }

    catch (error) {
        console.error('Error downloading/uploading recording:', error);
        throw error;
    };
};

const buildMessageField = (parsed_apt_data: any) => {
    const parts: string[] = [];

    if (parsed_apt_data.note) {
        parts.push(`message: ${parsed_apt_data.note}`);
    }

    if (parsed_apt_data.dental_issue) {
        parts.push(`Reason: ${parsed_apt_data.dental_issue}`);
    }

    if (parsed_apt_data.insurance == true) {
        const insuranceProvider = parsed_apt_data.insurance_provider || 'Other';
        parts.push(`Insurance: ${insuranceProvider}`);

        if (parsed_apt_data.subscriber_name) {
            parts.push(`Subscribers Full Name: ${parsed_apt_data.subscriber_name.toUpperCase()}`);
        }

        if (parsed_apt_data.subscriber_dob) {
            parts.push(`Subscriber's DOB: ${parsed_apt_data.subscriber_dob}`);
        }

        if (parsed_apt_data.subscriber_id) {
            parts.push(`Subscriber ID: ${parsed_apt_data.subscriber_id}`);
        }

        // if (parsed_apt_data.insurance_provider) {
        //     parts.push(`Insurance: ${parsed_apt_data.insurance_provider}`);
        // }
    }


    parts.push('Booked through All in One AI Receptionist');
    console.log('msg parts:', parts);
    return parts.join(' | ');
};