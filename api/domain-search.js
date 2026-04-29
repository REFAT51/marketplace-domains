export default async function handler(req, res) {
  try {
    const { domain } = req.query;

    if (!domain) {
      return res.status(400).json({
        error: "Domain is required"
      });
    }

    if (!process.env.GODADDY_API_KEY || !process.env.GODADDY_API_SECRET) {
      return res.status(500).json({
        error: "API keys are not configured"
      });
    }

    const response = await fetch(
      `https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`,
      {
        method: "GET",
        headers: {
          Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: "GoDaddy API error",
        details: errorText
      });
    }

    const data = await response.json();

    return res.status(200).json({
      domain: domain,
      available: data.available,
      price: data.price || null,
      currency: data.currency || "USD"
    });

  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
}
