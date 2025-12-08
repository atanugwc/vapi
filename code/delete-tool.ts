require('dotenv').config();
const { VapiClient } = require("@vapi-ai/server-sdk");
const client = new VapiClient({
  token: process.env.VAPI_PRIVATE_API_KEY, // or directly paste your token
});

(async () => {
  try {
    const toolId = "20ba3634-b8fe-4f01-af7d-c0c426d2d72f"; // your tool ID
    const result = await client.tools.delete(toolId);
    console.log("✅ Tool deleted successfully:", result);
  } catch (error) {
    console.error("❌ Error deleting tool:", error instanceof Error ? error.message : String(error));
  }
})();
