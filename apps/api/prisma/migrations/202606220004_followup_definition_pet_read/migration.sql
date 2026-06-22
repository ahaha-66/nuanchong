CREATE POLICY followup_definitions_pet_select ON followup_definitions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM followup_instances fi
    WHERE fi.definition_id = followup_definitions.id
      AND app_is_pet_member(fi.pet_id)
  )
);
