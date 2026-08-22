alter table properties add column if not exists short_term_rental_price_monthly_amount numeric(14, 2);
alter table properties add column if not exists short_term_rental_price_monthly_currency text;
alter table properties add column if not exists minimum_rental_months integer;
