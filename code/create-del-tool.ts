import { VapiClient } from "@vapi-ai/server-sdk";
import dotenv from "dotenv";

dotenv.config(); // Load .env variables first

// Initialize Vapi client with your API key
const vapi = new VapiClient({
  token: process.env.VAPI_PRIVATE_API_KEY!, // Ensure it's set in your .env
});

// Create an End Call tool
async function createEndCallTool() {
  try {
    const endCallTool = await vapi.tools.create({
      type: "endCall",
      messages: [
        {
          type: "request-start",
          content:
            "Alright, then. Thank you for calling. Have a great time! Bye.",
          blocking: false,
        },
      ],
    });

    console.log("✅ End Call Tool created successfully:");
    console.log(JSON.stringify(endCallTool, null, 2));
    return endCallTool;
  } catch (error) {
    console.error("❌ Error creating End Call Tool:", error);
    throw error;
  }
}

// Run
createEndCallTool();
