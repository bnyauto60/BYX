import Link from "next/link";
import { ConnectivityIndicator } from "./ConnectivityIndicator";

export function NavBar() {
  return (
    <header className="border-b border-line bg-panel sticky top-0 z-10">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-display text-xl font-semibold tracking-tight">
          BYX
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link href="/dashboard" className="hover:text-text">Tableau de bord</Link>
          <Link href="/vehicles" className="hover:text-text">Véhicules</Link>
          <Link href="/vehicles/new" className="hover:text-text">Nouveau véhicule</Link>
          <Link href="/diagnostic/new" className="hover:text-text">Diagnostic</Link>
          <Link href="/settings" className="hover:text-text">Paramètres</Link>
          <ConnectivityIndicator />
        </nav>
      </div>
    </header>
  );
}
