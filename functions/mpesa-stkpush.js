exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { phoneNumber, amount, bookId } = JSON.parse(event.body);

    const consumerKey = process.env.DARAJA_CONSUMER_KEY;
    const consumerSecret = process.env.DARAJA_CONSUMER_SECRET;
    
    // Clean up the Supabase URL to ensure it doesn't have trailing slashes or /rest/v1/
    let supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1);
    if (supabaseUrl.endsWith('/rest/v1')) supabaseUrl = supabaseUrl.replace('/rest/v1', '');

    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    // Hardcoded sandbox values for testing
    const shortcode = "174379";
    const passkey = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

    // 1. Get Auth Token
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const authRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` },
    });
    
    if (!authRes.ok) {
        throw new Error(`Auth failed: ${authRes.statusText}`);
    }
    
    const authData = await authRes.json();
    const token = authData.access_token;

    // 2. Prepare STK Push Payload
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    // Dynamically get the callback URL based on the incoming request
    const host = event.headers.host;
    // Handle localhost testing vs Netlify live environment
    const protocol = host.includes('localhost') ? 'http' : 'https'; 
    const callbackUrl = `${protocol}://${host}/.netlify/functions/mpesa-webhook`;

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: `Hekima_${bookId}`,
      TransactionDesc: `Unlock ${bookId}`
    };

    // 3. Send STK Push Request
    const stkRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const stkResult = await stkRes.json();

    if (stkResult.ResponseCode !== "0") {
      throw new Error(`Daraja rejected request: ${stkResult.errorMessage || JSON.stringify(stkResult)}`);
    }

    // 4. Save to Supabase as PENDING
    const supabaseRes = await fetch(`${supabaseUrl}/rest/v1/mpesa_transactions`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        checkout_request_id: stkResult.CheckoutRequestID,
        phone_number: phoneNumber,
        amount: amount,
        book_id: bookId,
        status: 'PENDING'
      })
    });

    if (!supabaseRes.ok) {
        const errorText = await supabaseRes.text();
        console.error("Supabase Error:", errorText);
        throw new Error(`Database error: ${errorText}`);
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ success: true, checkoutRequestId: stkResult.CheckoutRequestID }),
    };

  } catch (error) {
    console.error('STK Error:', error);
    return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
