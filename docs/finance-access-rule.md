# Finance access rule

## Church-wide finance access

Tithes & Offerings and Pledges have church-wide access when the signed-in account is:

- Admin
- Pastor
- Treasurer
- Linked to a member assigned to an active Treasurer/Treasury ministry

These users are authorized through `public.finance_access()`.

## Area Leader access

Area Leaders have scoped Tithes & Offerings access for their assigned Area only. In the current member model, the assigned Area is the scope used for the Area Leader's cellgroup/member roster.

An Area Leader may:

- View Tithes & Offerings belonging to members in their assigned Area.
- Encode a new ordinary Tithe or Offering for a member in their assigned Area.
- Work with Bible Study giving only when the Bible Study summary belongs to their assigned Area.

An Area Leader may not:

- View giving from another Area.
- Encode giving for a member in another Area.
- Receive church-wide finance access merely because they are an Area Leader.

If the same Area Leader is also linked to an active Treasurer/Treasury ministry assignment, the Treasurer authorization takes precedence and `public.finance_access()` grants the required church-wide finance access.

The database enforces these rules with Row Level Security (RLS). The user interface should mirror the same scope, but UI filtering is not treated as the security boundary.
