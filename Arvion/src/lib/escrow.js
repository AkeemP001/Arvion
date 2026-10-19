import { supabase } from './supabase.js'

export async function createEscrowHold({ reference, productId, sellerId, amount, buyer_email }) {
  const amountInKobo = amount * 100;
  const fee = Math.round(amountInKobo * 0.03);
  const sellerAmount = amountInKobo - fee;

  const { error } = await supabase.from('escrow_transactions').insert({
    paystack_reference: reference,
    product_id: productId,
    seller_id: sellerId,
    amount: amountInKobo,
    arvion_fee: fee,
    seller_amount: sellerAmount,
    buyer_email: buyer_email,
    status: 'held',
  });

  if (error) throw error;
  return true;
}