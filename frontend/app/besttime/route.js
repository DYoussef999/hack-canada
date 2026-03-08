export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const venue_id = searchParams.get("venue_id");
  
    // If no venue_id, return fallback
    if (!venue_id) {
      return Response.json({ busyness: 70, source: "fallback" });
    }
  
    try {
      const res = await fetch(
        `https://besttime.app/api/v1/forecasts/week?` +
          new URLSearchParams({
            api_key_public: process.env.BESTTIME_PUBLIC_KEY,
            venue_id: venue_id,
          }),
        { next: { revalidate: 3600 } } // cache for 1 hour
      );
  
      const data = await res.json();
  
      // Get current day (0=Sun, 1=Mon etc) and hour (0-23)
      const day = new Date().getDay();
      const hour = new Date().getHours();
  
      // BestTime stores days as 0=Monday so we adjust
      const adjustedDay = day === 0 ? 6 : day - 1;
  
      const busyness =
        data?.analysis?.[adjustedDay]?.day_raw?.[hour] ?? 70;
  
      return Response.json({
        busyness,
        venue_id,
        day: adjustedDay,
        hour,
        source: "besttime",
      });
    } catch (err) {
      console.error("BestTime API error:", err);
      return Response.json({ busyness: 70, source: "fallback" });
    }
  }
  
  export async function POST(request) {
    const { venue_name, venue_address } = await request.json();
  
    try {
      const res = await fetch("https://besttime.app/api/v1/forecasts", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          api_key_private: process.env.BESTTIME_PRIVATE_KEY,
          venue_name,
          venue_address,
        }),
      });
  
      const data = await res.json();
  
      return Response.json({
        venue_id: data?.venue_info?.venue_id,
        venue_name: data?.venue_info?.venue_name,
        venue_lat: data?.venue_info?.venue_lat,
        venue_lng: data?.venue_info?.venue_lng,
      });
    } catch (err) {
      console.error("BestTime forecast error:", err);
      return Response.json({ error: "Failed to create forecast" }, { status: 500 });
    }
  }