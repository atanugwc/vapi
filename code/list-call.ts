(async () => {
  const filter = {
    createdAt: {
      gte: "2025-12-03T00:00:00Z",
      lt: "2025-12-06T00:00:00Z"
    }
  };

  const params = new URLSearchParams({
    // filter: JSON.stringify(filter)
  });

  const response = await fetch(`https://api.vapi.ai/call?${params.toString()}`, {
    method: "GET",
    headers: {
      "Authorization": "Bearer 81a36441-2172-4b19-8dc1-ea56fd879341"
    },
  });

  const body = await response.json();
  console.log(JSON.stringify(body, null, 2));
})();
