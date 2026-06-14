-- Simple RLS fix: avoid recursion by checking user_id directly
-- No subquery on company_members from within company_members policies

-- Fix company_members policies (direct column check, no recursion)
DROP POLICY IF EXISTS "company_members_select" ON public.company_members;
CREATE POLICY "company_members_select" ON public.company_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "company_members_admin" ON public.company_members;
CREATE POLICY "company_members_admin" ON public.company_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "company_members_update_admin" ON public.company_members;
CREATE POLICY "company_members_update_admin" ON public.company_members
  FOR UPDATE USING (user_id = auth.uid() AND role = 'admin');

DROP POLICY IF EXISTS "company_members_delete_admin" ON public.company_members;
CREATE POLICY "company_members_delete_admin" ON public.company_members
  FOR DELETE USING (user_id = auth.uid() AND role = 'admin');

-- Fix data table policies (subquery on company_members is safe now)
DROP POLICY IF EXISTS "journal_entries_member" ON public.journal_entries;
CREATE POLICY "journal_entries_member" ON public.journal_entries
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_id = journal_entries.company_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "employees_member" ON public.employees;
CREATE POLICY "employees_member" ON public.employees
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_id = employees.company_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "invoices_member" ON public.invoices;
CREATE POLICY "invoices_member" ON public.invoices
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_id = invoices.company_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "payroll_slips_member" ON public.payroll_slips;
CREATE POLICY "payroll_slips_member" ON public.payroll_slips
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_id = payroll_slips.company_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "expenses_member" ON public.expenses;
CREATE POLICY "expenses_member" ON public.expenses
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_id = expenses.company_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "transactions_member" ON public.transactions;
CREATE POLICY "transactions_member" ON public.transactions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_id = transactions.company_id AND user_id = auth.uid()));

-- Fix companies select policy
DROP POLICY IF EXISTS "companies_member_select" ON public.companies;
CREATE POLICY "companies_member_select" ON public.companies
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.company_members WHERE company_id = companies.id AND user_id = auth.uid())
    OR owner_id = auth.uid()
  );

NOTIFY pgrst, 'reload schema';
