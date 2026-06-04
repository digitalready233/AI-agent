export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="platform-route-enter">{children}</div>;
}
