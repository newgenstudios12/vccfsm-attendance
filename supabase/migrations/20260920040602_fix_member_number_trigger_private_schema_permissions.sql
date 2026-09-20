-- Allow the member-number trigger to access its private sequence when inserts are performed by authenticated users.
-- The function already uses an empty search_path and fully qualified object names.
alter function vccf_private.assign_permanent_member_number()
security definer;
