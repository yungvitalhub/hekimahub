// The frontend calls this to check if the payment is complete
exports.handler = async (event, context) => {
    const { id } = event.queryStringParameters;
    if (!id) return { statusCode: 400, body: 'Missing ID' };

    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

        const res = await fetch(`${supabaseUrl}/rest/v1/mpesa_transactions?checkout_request_id=eq.${id}&select=status`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        
        const data = await res.json();
        
        if (data.length > 0) {
            return { statusCode: 200, body: JSON.stringify({ status: data[0].status }) };
        } else {
            return { statusCode: 404, body: JSON.stringify({ status: 'NOT_FOUND' }) };
        }
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
