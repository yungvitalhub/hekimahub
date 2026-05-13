// This file listens for Safaricom's automatic response
exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const payload = JSON.parse(event.body);
        const callbackData = payload.Body.stkCallback;
        
        const checkoutRequestId = callbackData.CheckoutRequestID;
        const resultCode = callbackData.ResultCode; // 0 means Success, anything else means Failed/Cancelled
        
        const status = resultCode === 0 ? 'SUCCESS' : 'FAILED';

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

        // Update the Supabase record
        await fetch(`${supabaseUrl}/rest/v1/mpesa_transactions?checkout_request_id=eq.${checkoutRequestId}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: status })
        });

        // Daraja expects a successful acknowledgment
        return {
            statusCode: 200,
            body: JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" })
        };

    } catch (error) {
        console.error('Webhook Error:', error);
        return { statusCode: 500, body: 'Server Error' };
    }
};
