export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // StackProvider is already in the root layout, no need to wrap again
  return (
    <>
      {/* Load Billabong font */}
      <link
        href="https://fonts.cdnfonts.com/css/billabong"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
