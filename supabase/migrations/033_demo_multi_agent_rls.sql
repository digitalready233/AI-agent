-- RLS for multi-agent and avatar routing tables (032/031 created tables without policies)

ALTER TABLE public.demo_agent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multi_agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_provider_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS demo_agent_assignments_org ON public.demo_agent_assignments;
CREATE POLICY demo_agent_assignments_org ON public.demo_agent_assignments
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS multi_agent_events_org ON public.multi_agent_events;
CREATE POLICY multi_agent_events_org ON public.multi_agent_events
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS avatar_routing_rules_org ON public.avatar_routing_rules;
CREATE POLICY avatar_routing_rules_org ON public.avatar_routing_rules
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS avatar_provider_metrics_org ON public.avatar_provider_metrics;
CREATE POLICY avatar_provider_metrics_org ON public.avatar_provider_metrics
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );
