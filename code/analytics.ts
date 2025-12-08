// // Example using fetch in JavaScript
// import dotenv from 'dotenv';
// dotenv.config();
// async function getIncomingCallsCount() {
//   const response = await fetch('https://api.vapi.ai/analytics', {
//     method: 'POST',
//     headers: {
//       'Authorization': 'Bearer ' + process.env.VAPI_PRIVATE_API_KEY,
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify({
//       "queries": [{
//         "name": "Incoming Call Count",
//         "table": "call", 
//         "timeRange": {
//           "start": "2023-01-01T00:00:00.000Z", 
//           "end": new Date().toISOString(), 
//           "step": "day"
//         },
//         "operations": [{
//           "operation": "count",
//           "column": "id",
//           "alias": "count"
//         }],
//         // "where": [
//         //   {
//         //     "column": "direction",
//         //     "operator": "eq",
//         //     "value": "inbound"
//         //   }
//         // ]
//       }]
//     })
//   });

//   const data = await response.json();
//   // save data in txt
//   const fs = require('fs');
//   fs.writeFileSync('data.txt', JSON.stringify(data));
//   return data;
// }


// getIncomingCallsCount().then(data => console.log(data));



import dotenv from 'dotenv';
dotenv.config();

async function getIncomingCallsCount(filters: { assistantId?: string, phoneNumberId?: string, startDate?: string, endDate?: string } = {}) {
    // Set up pagination parameters
    let allInboundCalls: any[] = [];
    let page = 1;
    let hasMoreCalls = true;
    const limit = 100; // Maximum records per page

    // Build query parameters
    let queryParams = new URLSearchParams({
        limit: limit.toString()
    });

    // Add optional filters if provided
    if (filters.assistantId) {
        queryParams.append('assistantId', filters.assistantId.toString());
    }

    if (filters.phoneNumberId) {
        queryParams.append('phoneNumberId', filters.phoneNumberId.toString());
    }

    // Note: Date filtering will be done client-side since API doesn't support date query params

    try {
        // Fetch all results (Vapi API doesn't use traditional pagination)
        while (hasMoreCalls) {
            const response = await fetch(`https://api.vapi.ai/call?${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.VAPI_PRIVATE_API_KEY}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                throw new Error(`API error: ${response.status}`);
            }

            const result = await response.json();

            // Check if we have data and if it's in the expected format
            const calls = Array.isArray(result) ? result : (result.data || []);

            // Filter for inbound calls only (since API doesn't support type filtering)
            let filteredCalls = calls.filter((call: any) => call.type === 'inboundPhoneCall');

            // Apply date filters client-side (since API doesn't support date query params)
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                filteredCalls = filteredCalls.filter((call: any) => {
                    const callDate = new Date(call.createdAt);
                    return callDate >= startDate;
                });
            }

            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                filteredCalls = filteredCalls.filter((call: any) => {
                    const callDate = new Date(call.createdAt);
                    return callDate <= endDate;
                });
            }

            if (filteredCalls.length > 0) {
                allInboundCalls = [...allInboundCalls, ...filteredCalls];
            }

            // Vapi API returns all results in one call up to the limit
            // No pagination needed, so we're done after first fetch
            hasMoreCalls = false;
        }

        return {
            totalCount: allInboundCalls.length,
            calls: allInboundCalls
        };
    } catch (error) {
        console.error('Error fetching call counts:', error);
        throw error;
    }
}

// Example usage:
async function main() {
    try {
        // Get all incoming calls
        const allIncoming = await getIncomingCallsCount();
        console.log(`Total incoming calls: ${allIncoming.totalCount}`);

        // Filter by specific assistant
        const assistantCalls = await getIncomingCallsCount({
            assistantId: 'b3f96cf0-2166-4437-8027-546bbea79f7a'
        });
        console.log(`Calls for specific assistant: ${assistantCalls.totalCount}`);

        // Filter by phone number
        const phoneNumberCalls = await getIncomingCallsCount({
            phoneNumberId: '7807a9e1-ba4c-4779-b5fa-ee81311e22a8'
        });
        console.log(`Calls for specific phone number: ${phoneNumberCalls.totalCount}`);

        // Filter by date range (last 7 days)
        const lastWeekStart = new Date();
        // lastWeekStart.setDate(lastWeekStart.getDate() - 7);

        // const recentCalls = await getIncomingCallsCount({
        //     startDate: lastWeekStart.toISOString(),
        //     endDate: new Date().toISOString()
        // });
        // console.log(`Calls in the last 7 days: ${recentCalls.totalCount}`);

        // Filter by custom date range (e.g., December 1-30, 2025)
        const customRangeCalls = await getIncomingCallsCount({
            assistantId: 'b3f96cf0-2166-4437-8027-546bbea79f7a',
            startDate: '2025-12-01T00:00:00.000Z',
            endDate: '2025-12-30T23:59:59.999Z'
        });
        // console.log(`\n=== DECEMBER 2025 DATE RANGE FILTER ===`);
        console.log(`Calls according to date range for assistant: ${customRangeCalls.totalCount}`);

        // Show first and last call in this date range
        if (customRangeCalls.calls.length > 0) {
            const sortedDecCalls = [...customRangeCalls.calls].sort((a: any, b: any) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            const firstDecCall = sortedDecCalls[0];
            const lastDecCall = sortedDecCalls[sortedDecCalls.length - 1];

            // console.log(`\n--- FIRST CALL in December 2025 ---`);
            console.log(`  - Call ID: ${firstDecCall.id}`);
            console.log(`  - Created: ${new Date(firstDecCall.createdAt).toLocaleString()}`);
            // console.log(`  - Status: ${firstDecCall.status || 'N/A'}`);
            // console.log(`  - Duration: ${firstDecCall.endedAt ? Math.round((new Date(firstDecCall.endedAt).getTime() - new Date(firstDecCall.startedAt).getTime()) / 1000) + 's' : 'N/A'}`);

            // console.log(`\n--- LAST CALL in December 2025 ---`);
            console.log(`  - Call ID: ${lastDecCall.id}`);
            console.log(`  - Created: ${new Date(lastDecCall.createdAt).toLocaleString()}`);
            // console.log(`  - Status: ${lastDecCall.status || 'N/A'}`);
            // console.log(`  - Duration: ${lastDecCall.endedAt ? Math.round((new Date(lastDecCall.endedAt).getTime() - new Date(lastDecCall.startedAt).getTime()) / 1000) + 's' : 'N/A'}`);

            // Calculate time span within December
            // const decTimeSpan = new Date(lastDecCall.createdAt).getTime() - new Date(firstDecCall.createdAt).getTime();
            // const decDaySpan = Math.floor(decTimeSpan / (1000 * 60 * 60 * 24));
            // const decHourSpan = Math.floor((decTimeSpan % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

            // console.log(`\n--- TIME SPAN in December 2025 ---`);
            // console.log(`  - First call: ${new Date(firstDecCall.createdAt).toLocaleDateString()}`);
            // console.log(`  - Last call: ${new Date(lastDecCall.createdAt).toLocaleDateString()}`);
            // console.log(`  - Span: ${decDaySpan} days and ${decHourSpan} hours`);
        }

        // Filter by last 30 days
        // const last30DaysStart = new Date();
        // last30DaysStart.setDate(last30DaysStart.getDate() - 30);

        // const last30DaysCalls = await getIncomingCallsCount({
        //     startDate: last30DaysStart.toISOString(),
        //     endDate: new Date().toISOString()
        // });
        // console.log(`Calls in the last 30 days: ${last30DaysCalls.totalCount}`);

        // Combine filters: specific assistant + date range
        // const assistantLastWeek = await getIncomingCallsCount({
        //     assistantId: 'b3f96cf0-2166-4437-8027-546bbea79f7a',
        //     startDate: lastWeekStart.toISOString(),
        //     endDate: new Date().toISOString()
        // });
        // console.log(`Calls for specific assistant in last 7 days: ${assistantLastWeek.totalCount}`);

        // Get last 50 calls for a specific assistant
        const assistantAllCalls = await getIncomingCallsCount({
            assistantId: 'b3f96cf0-2166-4437-8027-546bbea79f7a'
        });

        // Sort by createdAt descending (most recent first) and take first 4
        const last50Calls = assistantAllCalls.calls
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 4);

        // console.log(`\nLast 2 calls for assistant:`);
        // console.log(`Total calls for this assistant: ${assistantAllCalls.totalCount}`);
        console.log(`Showing most recent: ${last50Calls.length} calls for the assistant`);

        // Show first (oldest) and last (most recent) call details
        // Show first (oldest) and last (most recent) call details FROM THE FILTERED SUBSET
        if (last50Calls.length > 0) {
            // last50Calls is already sorted descending (index 0 is newest, last index is oldest)
            const mostRecentCall = last50Calls[0];
            const oldestCall = last50Calls[last50Calls.length - 1];

            // console.log(`\n=== OLDEST of the last ${last50Calls.length} calls ===`);
            console.log(`  - Call ID: ${oldestCall.id}`);
            console.log(`  - Created: ${new Date(oldestCall.createdAt).toLocaleString()}`);
            // console.log(`  - Status: ${oldestCall.status || 'N/A'}`);
            // console.log(`  - Duration: ${oldestCall.endedAt ? Math.round((new Date(oldestCall.endedAt).getTime() - new Date(oldestCall.startedAt).getTime()) / 1000) + 's' : 'N/A'}`);

            // console.log(`\n=== NEWEST of the last ${last50Calls.length} calls ===`);
            console.log(`  - Call ID: ${mostRecentCall.id}`);
            console.log(`  - Created: ${new Date(mostRecentCall.createdAt).toLocaleString()}`);
            // console.log(`  - Status: ${mostRecentCall.status || 'N/A'}`);
            // console.log(`  - Duration: ${mostRecentCall.endedAt ? Math.round((new Date(mostRecentCall.endedAt).getTime() - new Date(mostRecentCall.startedAt).getTime()) / 1000) + 's' : 'N/A'}`);

            // Calculate time span
            // const timeSpan = new Date(mostRecentCall.createdAt).getTime() - new Date(oldestCall.createdAt).getTime();
            // const daySpan = Math.floor(timeSpan / (1000 * 60 * 60 * 24));
            // const hourSpan = Math.floor((timeSpan % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

            // console.log(`\n=== TIME SPAN (Last ${last50Calls.length} calls) ===`);
            // console.log(`  - Start: ${new Date(oldestCall.createdAt).toLocaleString()}`);
            // console.log(`  - End:   ${new Date(mostRecentCall.createdAt).toLocaleString()}`);
            // console.log(`  - Span:  ${daySpan} days and ${hourSpan} hours`);
        }

    } catch (error) {
        console.error('Error in main function:', error);
    }
}

// Helper function: Get last N calls for a specific assistant
// async function getLastNCalls(assistantId: string, limit: number = 50) {
//     const result = await getIncomingCallsCount({ assistantId });

//     // Sort by createdAt descending (most recent first) and limit
//     const lastNCalls = result.calls
//         .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
//         .slice(0, limit);

//     return {
//         totalCount: result.totalCount,
//         calls: lastNCalls,
//         showing: lastNCalls.length
//     };
// }

main();




// all assistant cost 


// curl --location 'https://api.vapi.ai/analytics' \
// --header 'authorization: Bearer 81a36441-2172-4b19-8dc1-ea56fd879341' \
// --header 'content-type: application/json' \
// --header 'Cookie: _cfuvid=mn9dzTJI3uSS_sHLgf7mRM4IvUWPQH4bNtbzxupJXXY-1764842544.8205059-1.0.1.1-uz4jI6xhusv_t0PEmU56PEpI_s9YFeG3YkXXHkqVyJE' \
// --data '{
//     "queries": [{
//       "name": "Cost Analysis",
//       "table": "call",
//       "timeRange": {
//         "start": "2025-11-12T18:30:00.000Z",
//         "end": "2025-12-17T05:31:10.184Z",
//         "step": "day"
//       },
//       "operations": [{
//         "operation": "sum",
//         "column": "cost",
//         "alias": "total_cost"
//       }],
//       "groupBy": ["assistantId"]
//     }]
//   }'

