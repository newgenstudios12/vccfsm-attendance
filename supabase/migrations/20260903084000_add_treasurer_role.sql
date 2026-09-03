-- Add Treasurer as an application account type.
-- Kept separate because new enum values must be committed before later migrations reference them.

alter type public.app_role add value if not exists 'treasurer';
