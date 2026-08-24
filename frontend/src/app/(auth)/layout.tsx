export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="soft-accent-wash flex min-h-svh flex-col items-center justify-center px-4 py-10">
      {children}
    </div>
  );
}
