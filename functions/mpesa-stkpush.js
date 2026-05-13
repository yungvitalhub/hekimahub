exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { phoneNumber, amount, bookId } = JSON.parse(event.body);

    const consumerKey = process.env.DARAJA_CONSUMER_KEY; 
    const consumerSecret = process.env.DARAJA_CONSUMER_SECRET;
    const shortcode = process.env.DARAJA_SHORTCODE || '174379'; 
    const passkey = process.env.DARAJA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
    
    // Netlify automatically provides process.env.URL
    const callbackUrl = `${process.env.URL}/.netlify/functions/mpesa-webhook`;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    // 1. Get Daraja Token
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` }
    });
    const { access_token: accessToken } = await tokenRes.json();

    // 2. Prepare STK Push
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const stkData = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount), // Daraja requires whole numbers
      PartyA: phoneNumber, 
      PartyB: shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: `Hekima-${bookId}`,
      TransactionDesc: `Ebook: ${bookId}`
    };

    // 3. Send STK Push
    const stkRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(stkData)
    });
    const stkResult = await stkRes.json();

    if (stkResult.ResponseCode !== "0") {
      throw new Error(stkResult.errorMessage || 'Failed to initiate STK Push');
    }

    // 4. Save to Supabase as PENDING
    await fetch(`${supabaseUrl}/rest/v1/mpesa_transactions`, {
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

    return {
        statusCode: 200,
        body: JSON.stringify({ success: true, checkoutRequestId: stkResult.CheckoutRequestID }),
    };

  } catch (error) {
    console.error('STK Error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
