create table public.escrow_transactions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid,
  seller_id uuid,
  product_id uuid,
  amount integer not null,
  paystack_reference text unique not null,
  status text default 'held',
  arvion_fee integer,
  seller_amount integer,
  buyer_email text,
  created_at timestamptz default now(),
  constraint escrow_transactions_status_check
    check (status in ('held', 'released', 'refunded', 'disputed'))
);

comment on column public.escrow_transactions.amount is 'amount in kobo';
comment on column public.escrow_transactions.arvion_fee is '3% fee in kobo';
comment on column public.escrow_transactions.seller_amount is 'amount seller will receive';

create index escrow_transactions_status_idx
  on public.escrow_transactions (status);

alter table public.escrow_transactions enable row level security;
grant all on public.escrow_transactions to authenticated;

create policy "Authenticated users can manage escrow transactions"
on public.escrow_transactions
for all
to authenticated
using (true)
with check (true);
