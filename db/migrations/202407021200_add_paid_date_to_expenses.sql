ALTER TABLE expenses ADD COLUMN paid_date DATE;
UPDATE expenses SET paid_date = expense_date WHERE paid_date IS NULL;
