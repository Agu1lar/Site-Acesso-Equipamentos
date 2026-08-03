-- Flag whether the visitor had accepted analytics cookies when the event fired.
-- Lets the admin panel compare WhatsApp clicks eligible for Google Ads vs all clicks.
ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS analytics_consent boolean;
