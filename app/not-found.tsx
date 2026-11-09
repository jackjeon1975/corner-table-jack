import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="empty">
      <div className="big">This seat is empty.</div>
      The page doesn&apos;t exist or isn&apos;t public. <Link href="/">Back to the table →</Link>
    </div>
  );
}
