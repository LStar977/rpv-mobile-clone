export function Container({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-w-page mx-auto px-6 md:px-10 ${className}`}>
      {children}
    </div>
  );
}
