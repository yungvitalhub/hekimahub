exports.handler = async (event, context) => {
    const { id } = event.queryStringParameters;
    if (!id) return { statusCode: 400, body: 'Missing ID' };

    try {
        // Clean up Supabase URL
        let supabaseUrl = process.env.SUPABASE_URL;
        if (supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1);
        if (supabaseUrl.endsWith('/rest/v1')) supabaseUrl = supabaseUrl.replace('/rest/v1', '');

        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

        const res = await fetch(`${supabaseUrl}/rest/v1/mpesa_transactions?checkout_request_id=eq.${id}&select=status`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        
        const data = await res.json();
        
        if (data && data.length > 0) {
            return { statusCode: 200, body: JSON.stringify({ status: data[0].status }) };
        } else {
            return { statusCode: 404, body: JSON.stringify({ status: 'NOT_FOUND' }) };
        }
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
