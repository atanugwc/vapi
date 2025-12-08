require('dotenv').config();
import { VapiClient } from "@vapi-ai/server-sdk";

(async () => {
  try {
    const client = new VapiClient({ token: process.env.VAPI_PRIVATE_API_KEY! });

    const numberId = ""; // your number ID
    const response = await client.phoneNumbers.delete(numberId);

    console.log("Number deleted successfully:", response);
  } catch (error: any) {
    console.error("Error deleting number:", error.message || error);
  }
})();
