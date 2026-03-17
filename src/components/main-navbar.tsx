"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, db } from "@/lib/firebase";

const primaryMenuItems = [
  { href: "/", label: "Dashboard" },
  { href: "/hearing", label: "Presensi Hearing" },
  { href: "/calon", label: "Profil Calon" },
  { href: "/voting", label: "Voting" },
  { href: "/hasil", label: "Hasil Voting" },
  { href: "/profile", label: "Cek Status" },
  { href: "/profil", label: "Profil User" },
  { href: "/setting", label: "Setting" },
];

export function MainNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setIsAdmin(false);
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, "admin_users", currentUser.uid));
        setIsAdmin(adminDoc.exists() && adminDoc.data().active === true);
      } catch {
        setIsAdmin(false);
      }
    });

    return unsubscribe;
  }, []);

  async function onLogout() {
    await signOut(getFirebaseAuth());
    closeMenu();
  }

  return (
    <>
      <header className="overflow-x-hidden border-b border-foreground/15">
        <nav className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Link href="/" className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/LOGO_DPA_FIX.png"
                  alt="Logo DPA"
                  className="h-10 w-10 shrink-0 object-contain md:h-12 md:w-12"
                />
                <span className="font-display wrap-break-word text-2xl font-bold tracking-wide text-[--maroon]">
                  DPA HIMAFI ITB
                </span>
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setIsMenuOpen((previous) => !previous)}
              className="button-outline px-4 py-2 text-xs"
              aria-expanded={isMenuOpen}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </nav>
      </header>

      <div
        className={`fixed inset-0 z-40 transition ${isMenuOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!isMenuOpen}
      >
        <button
          type="button"
          onClick={closeMenu}
          className={`absolute inset-0 bg-[rgb(26_26_26/0.4)] transition-opacity ${isMenuOpen ? "opacity-100" : "opacity-0"}`}
          aria-label="Tutup menu"
        />

        <aside
          className={`absolute right-0 top-0 h-full w-80 max-w-[88vw] overflow-x-hidden border-l border-[--gold-soft] bg-[linear-gradient(180deg,#fff9ee,#f4f1e8)] p-5 transition-transform ${isMenuOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <p className="section-kicker">Navigation</p>
              <p className="font-display text-3xl text-[--maroon]">DPA HIMAFI</p>
            </div>

            <button
              type="button"
              onClick={closeMenu}
              className="button-outline px-4 py-2 text-xs"
              aria-label="Tutup drawer"
            >
              ✕
            </button>
          </div>

          <div className="flex h-[calc(100%-5.5rem)] min-w-0 flex-col">
            <ul className="grid gap-3 text-sm">
            {primaryMenuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeMenu}
                  className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-[--gold-soft] bg-white/70 px-4 py-3 font-semibold text-[--maroon]"
                >
                  <span className="min-w-0 wrap-break-word">{item.label}</span>
                </Link>
              </li>
            ))}
            </ul>

            <div className="mt-auto grid gap-3 pt-8 text-sm">
              <Link
                href="/admin"
                onClick={closeMenu}
                className="button-admin-box flex w-full items-center"
              >
                <span>{isAdmin ? "Admin DPA" : "Admin"}</span>
              </Link>

              {user ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="button-auth-box inline-flex w-full items-center justify-center"
                >
                  Logout
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="button-auth-box inline-flex w-full items-center justify-center"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}