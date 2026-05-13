 if (stkResult.ResponseCode !== "0") {
      throw new Error(stkResult.errorMessage || 'Failed to initiate STK Push');
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
