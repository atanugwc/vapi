require('dotenv').config();
import { VapiClient } from "@vapi-ai/server-sdk";

const client = new VapiClient({ token: process.env.VAPI_PRIVATE_API_KEY! });
client.assistants.delete("YOUR_ASSISTANT_ID_HERE");
console.log("Assistant deleted successfully:");
