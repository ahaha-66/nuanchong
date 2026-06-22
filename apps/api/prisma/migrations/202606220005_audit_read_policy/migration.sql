CREATE POLICY audit_actor_select ON audit_logs FOR SELECT USING (
  actor_user_id = app_user_id()
  OR (organization_id IS NOT NULL AND app_is_organization_member(organization_id))
);
