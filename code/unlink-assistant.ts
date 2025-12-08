import { VapiClient } from "@vapi-ai/server-sdk";
import dotenv from "dotenv";
dotenv.config();

const vapi = new VapiClient({
  token: process.env.VAPI_PRIVATE_API_KEY!,
});

async function removeAssistant() {
  await vapi.phoneNumbers.update(
    "31398810-6764-4402-9ce5-197da0ae671c",
    {
      // @ts-ignore
      assistantId: null
    }
  );

  console.log("Assistant removed from phone number");
}

removeAssistant().catch(console.error);
