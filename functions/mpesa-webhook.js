exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const payload = JSON.parse(event.body);
        
        // Safaricom sometimes sends empty bodies on timeouts
        if (!payload || !payload.Body || !payload.Body.stkCallback) {
             return { statusCode: 200, body: 'Ignored' };
        }

        const callbackData = payload.Body.stkCallback;
        const checkoutRequestId = callbackData.CheckoutRequestID;
        const resultCode = callbackData.ResultCode; 
        
        // 0 means Success, anything else (like 1032) means Failed/Cancelled
        const status = resultCode === 0 ? 'SUCCESS' : 'FAILED';

        // Clean up Supabase URL just in case
        let supabaseUrl = process.env.SUPABASE_URL;
        if (supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1);
        if (supabaseUrl.endsWith('/rest/v1')) supabaseUrl = supabaseUrl.replace('/rest/v1', '');

        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

        // Update the Supabase record
        const res = await fetch(`${supabaseUrl}/rest/v1/mpesa_transactions?checkout_request_id=eq.${checkoutRequestId}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ status: status })
        });

        if (!res.ok) {
            console.error("Webhook Supabase Error:", await res.text());
        }

        // Safaricom Daraja expects a successful acknowledgment quickly
        return {
            statusCode: 200,
            body: JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" })
        };

    } catch (error) {
        console.error('Webhook Error:', error);
        return { statusCode: 500, body: 'Server Error' };
    }
};
