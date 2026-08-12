-- Add email column to profiles table
-- Allows the app to display and store user email alongside profile data.
-- Backfills existing rows from auth.users.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id;
