-- Allow deleting agent↔KB links when removing a knowledge base (not only when replacing links for one agent).

drop policy if exists akb_delete_by_kb on public.agent_knowledge_bases;
create policy akb_delete_by_kb on public.agent_knowledge_bases
  for delete
  using (
    exists (
      select 1
      from public.knowledge_bases kb
      where kb.id = knowledge_base_id
        and kb.organization_id = public.user_organization_id()
    )
  );
