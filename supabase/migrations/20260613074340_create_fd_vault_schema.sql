
-- Family members table
CREATE TABLE family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_select_family_members" ON family_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_family_members" ON family_members FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_family_members" ON family_members FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_family_members" ON family_members FOR DELETE TO anon, authenticated USING (true);

-- Deposits table
CREATE TABLE deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('FD', 'RD')),
  bank text NOT NULL,
  family_member_name text NOT NULL DEFAULT 'Self',
  principal_amount numeric NOT NULL,
  interest_rate numeric NOT NULL,
  start_date date NOT NULL,
  tenure_years integer DEFAULT 0,
  tenure_months integer DEFAULT 0,
  tenure_days integer DEFAULT 0,
  compounding_frequency text DEFAULT 'Quarterly',
  interest_payout text DEFAULT 'Cumulative',
  maturity_amount numeric,
  interest_earned numeric,
  effective_yield numeric,
  maturity_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'matured', 'closed')),
  auto_renewal boolean DEFAULT false,
  account_reference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_select_deposits" ON deposits FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_insert_deposits" ON deposits FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_update_deposits" ON deposits FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_delete_deposits" ON deposits FOR DELETE TO anon, authenticated USING (true);

-- Seed sample family members
INSERT INTO family_members (name) VALUES ('Self'), ('Spouse'), ('Parent'), ('Child');

-- Seed sample deposits
INSERT INTO deposits (name, type, bank, family_member_name, principal_amount, interest_rate, start_date, tenure_years, tenure_months, tenure_days, compounding_frequency, interest_payout, maturity_amount, interest_earned, effective_yield, maturity_date, status) VALUES
('Short Term Park', 'FD', 'Axis Bank', 'Self', 100000, 7.25, '2023-06-01', 1, 0, 0, 'Quarterly', 'Cumulative', 103381, 3381, 7.36, '2024-06-01', 'matured'),
('Car Downpayment', 'FD', 'HDFC Bank', 'Self', 400000, 7.10, '2024-01-15', 2, 0, 0, 'Quarterly', 'Cumulative', 429798, 29798, 7.36, '2026-06-26', 'active'),
('Emergency Fund', 'FD', 'SBI', 'Self', 500000, 6.80, '2024-03-01', 3, 0, 0, 'Quarterly', 'Cumulative', 612000, 112000, 7.20, '2027-03-01', 'active'),
('Tax Saver FD', 'FD', 'ICICI Bank', 'Spouse', 150000, 7.50, '2024-04-01', 5, 0, 0, 'Annually', 'Cumulative', 215000, 65000, 7.45, '2029-04-01', 'active'),
('Monthly Income', 'RD', 'SBI', 'Spouse', 10000, 6.50, '2024-01-01', 0, 12, 0, 'Quarterly', 'Monthly', 125000, 5000, 6.60, '2025-01-01', 'active'),
('Child Education', 'FD', 'HDFC Bank', 'Child', 200000, 7.20, '2023-12-01', 5, 0, 0, 'Quarterly', 'Cumulative', 285000, 85000, 7.25, '2028-12-01', 'active'),
('House Down Payment', 'RD', 'ICICI Bank', 'Self', 20000, 6.75, '2024-02-01', 0, 24, 0, 'Quarterly', 'Cumulative', 520000, 40000, 6.80, '2026-02-01', 'active');
