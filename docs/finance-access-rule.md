# Finance access rule

Tithes & Offerings and Pledges are available only when the signed-in account is:

- Admin
- Pastor
- Treasurer
- Linked to a member assigned to the active `Treasurer` ministry

The database enforces the same rule through `public.finance_access()` and RLS. The navigation also resolves this access before showing the Finance group.
