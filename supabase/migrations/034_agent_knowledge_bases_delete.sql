-- Allow org members to replace agent ↔ knowledge base links on save (DELETE was missing; INSERT-only caused 23505 duplicates).

drop policy if exists akb_delete on public.agent_knowledge_bases;
create policy akb_delete on public.agent_knowledge_bases
  for delete
  using (
    exists (
      select 1
      from public.agents a
      where a.id = agent_id
        and a.organization_id = public.user_organization_id()
    )
  );
