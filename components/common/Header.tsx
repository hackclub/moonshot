'use client';
import { useState, useRef, useEffect } from "react";
import { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { createAvatar } from '@dicebear/core';
import { thumbs } from '@dicebear/collection';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiFetch';
import { usePathname } from 'next/navigation';
import { AppConfig } from '@/lib/config';
import ExperienceToggle from './ExperienceToggle';
import { useExperienceMode } from '@/lib/useExperienceMode';

export type HeaderProps = {
    session: Session | null;
    status: "authenticated" | "unauthenticated" | "loading";
};

interface TravelStipend {
    totalHours: number;
    totalAmount: number;
}

interface ShopOrder {
    id: string;
    itemName: string;
    quantity: number;
    status: string;
}

export default function Header({ session, status }: HeaderProps) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [adminMenuOpen, setAdminMenuOpen] = useState(false);
    const [isShopOrdersAdmin, setIsShopOrdersAdmin] = useState(false);
    const [travelStipends, setTravelStipends] = useState<TravelStipend | null>(null);
    const [stardust, setStardust] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const mobileMenuRef = useRef<HTMLDivElement>(null);
    const adminMenuRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const { isIslandMode } = useExperienceMode();
    
    // Add CSS animation for gradient shift and glow effects
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes gradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            @keyframes flashGlow {
                0% { 
                    text-shadow: 0 0 10px rgba(139, 92, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3);
                    filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.6));
                }
                50% { 
                    text-shadow: 0 0 20px rgba(139, 92, 246, 0.8), 0 0 30px rgba(59, 130, 246, 0.6), 0 0 40px rgba(139, 92, 246, 0.4);
                    filter: drop-shadow(0 0 15px rgba(139, 92, 246, 0.9));
                }
                100% { 
                    text-shadow: 0 0 10px rgba(139, 92, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3);
                    filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.6));
                }
            }
        `;
        document.head.appendChild(style);
        
        return () => {
            document.head.removeChild(style);
        };
    }, []);
    
    // Fetch isShopOrdersAdmin, travel stipends, and stardust on mount
    useEffect(() => {
        if (status === 'authenticated') {
            // Fetch user data
            apiFetch('/api/users/me').then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    setIsShopOrdersAdmin(!!data.isShopOrdersAdmin);
                }
            });

            // Fetch travel stipends
            apiFetch('/api/users/me/shop-orders').then(async (res) => {
                if (res.ok) {
                    const ordersData = await res.json();
                    
                    // Calculate travel stipend total from fulfilled orders
                    let totalHours = 0;
                    ordersData.orders.forEach((order: ShopOrder) => {
                        if (order.status === 'fulfilled' && order.itemName.toLowerCase().includes('travel stipend')) {
                            totalHours += order.quantity; // Each quantity represents 1 hour
                        }
                    });
                    
                    setTravelStipends({
                        totalHours,
                        totalAmount: totalHours * 10 // $10 per hour
                    });
                }
            });

            // Fetch stardust balance
            apiFetch('/api/users/me/currency').then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    // Prefer top-level availablecurrency; fall back to legacy keys
                    const balance =
                        typeof data?.availablecurrency === 'number' ? data.availablecurrency :
                        typeof data?.currency === 'number' ? data.currency :
                        typeof data?.progress?.availablecurrency === 'number' ? data.progress.availablecurrency : 0;
                    setStardust(Number(balance));
                }
            }).catch(() => {});
        }
    }, [status]);

    // More robust role checking - explicitly check for roles, don't show admin/review for regular users 
    const userRole = session?.user?.role || 'User';
    const isUserAdmin = userRole === 'Admin' || (session?.user?.isAdmin === true && userRole !== 'User');
    const isUserReviewer = userRole === 'Admin' || userRole === 'Reviewer';

    // Eligibility for shop
    const userStatus = session && session.user && typeof session.user.status === 'string' ? session.user.status : 'Unknown';
    const canAccessShop = isUserAdmin || (userStatus !== 'FraudSuspect' && userStatus !== 'Unknown');

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
                setMobileMenuOpen(false);
            }
            if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
                setAdminMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const isActive = (path: string) => {
        return pathname === path;
    };

    const isAdminActive = () => {
        return pathname === '/admin' || pathname.startsWith('/admin/');
    };

    // Ensure starry background is applied to body when Header mounts, removed when unmounts
    useEffect(() => {
        document.body.classList.add('starspace-bg');
        return () => {
            document.body.classList.remove('starspace-bg');
        };
    }, []);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 w-full px-4 sm:px-6 py-4 bg-transparent flex items-center justify-between shadow-md" style={{ backgroundColor: 'var(--background)' }}>
            <div className="flex items-center relative min-w-0" ref={mobileMenuRef}>
                {/* Mobile menu button */}
                <button 
                    className="md:hidden text-white mr-4 focus:outline-none"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                    </svg>
                </button>
                
                {/* (removed) stardust display here - moved to right container */}

                {/* Desktop menu */}
                <div className="hidden md:flex space-x-3 lg:space-x-4 xl:space-x-6 text-white">
                    <Link 
                        href="/launchpad" 
                        className={`transition-colors ${isActive('/launchpad') ? 'font-semibold underline underline-offset-4' : 'hover:text-cyan-100'}`}
                    >
                        My Projects
                    </Link>
                    <Link 
                        href="/gallery" 
                        className={`transition-colors ${isActive('/gallery') ? 'font-semibold underline underline-offset-4' : 'hover:text-cyan-100'}`}
                    >
                        Gallery
                    </Link>
                    {!isIslandMode && (
                        <>
                            <Link 
                                href="/leaderboard" 
                                className={`transition-colors ${isActive('/leaderboard') ? 'font-semibold underline underline-offset-4' : 'hover:text-cyan-100'}`}
                            >
                                Leaderboard
                            </Link>
                            <Link 
                                href="/launchpad/faq" 
                                className={`transition-colors ${isActive('/launchpad/faq') ? 'font-semibold underline underline-offset-4' : 'hover:text-cyan-100'}`}
                            >
                                FAQ
                            </Link>
                            <Link 
                                href="/launchpad/badge" 
                                className={`transition-colors ${isActive('/launchpad/badge') ? 'font-semibold underline underline-offset-4' : 'hover:text-cyan-100'}`}
                            >
                                Badge
                            </Link>
                            <Link 
                                href="/settings" 
                                className={`transition-colors ${isActive('/settings') ? 'font-semibold underline underline-offset-4' : 'hover:text-cyan-100'}`}
                            >
                                Settings
                            </Link>
                        </>
                    )}
                    {/* Show Review tab for reviewers and admins */}
                    {!isIslandMode && isUserReviewer && (
                        <Link 
                            href="/review" 
                            className={`transition-colors ${isActive('/review') ? 'font-semibold underline underline-offset-4' : 'hover:text-cyan-100'}`}
                        >
                            Review
                        </Link>
                    )}
                    {/* Eligible users can access Shop */}
                    {!isIslandMode && canAccessShop && (
                        <Link 
                            href="/launchpad/shop" 
                            className={`relative transition-all duration-300 ${isActive('/launchpad/shop') ? 'font-semibold underline underline-offset-4' : 'hover:text-cyan-100'}`}
                            style={{
                                background: 'linear-gradient(45deg, #8b5cf6, #3b82f6, #8b5cf6)',
                                backgroundSize: '200% 200%',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                animation: 'gradientShift 3s ease-in-out infinite, flashGlow 2s ease-in-out infinite',
                                textShadow: '0 0 10px rgba(139, 92, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)',
                                filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))'
                            }}
                        >
                            ✨ Shop ✨
                        </Link>
                    )}
                    {/* Admin section with dropdown for admin users */}
                    {!isIslandMode && isUserAdmin && (
                        <div className="relative group" ref={adminMenuRef}>
                            <button
                                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                                className={`flex items-center transition-colors ${
                                    isAdminActive()
                                        ? 'font-semibold underline underline-offset-4'
                                        : 'hover:text-orange-400 group-hover:text-orange-400'
                                } ${adminMenuOpen ? 'text-orange-400' : ''}`}
                            >
                                Admin
                                <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={adminMenuOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                </svg>
                            </button>
                            
                            {adminMenuOpen && (
                                <div className="absolute left-0 mt-2 bg-black text-white rounded-lg shadow-lg p-2 z-20 w-48 border border-white/10">
                                    <Link 
                                        href="/admin" 
                                        className={`block px-3 py-2 rounded transition-colors ${
                                            isActive('/admin') 
                                                ? 'bg-orange-600/25 border-l-4 border-orange-500' 
                                                : 'hover:bg-orange-600/20 border-l-4 border-transparent'
                                        }`}
                                        onClick={() => setAdminMenuOpen(false)}
                                    >
                                        Dashboard
                                    </Link>
                                    <Link 
                                        href="/admin/users" 
                                        className={`block px-3 py-2 rounded transition-colors ${
                                            isActive('/admin/users') || pathname.startsWith('/admin/users/') 
                                                ? 'bg-orange-600/25 border-l-4 border-orange-500' 
                                                : 'hover:bg-orange-600/20 border-l-4 border-transparent'
                                        }`}
                                        onClick={() => setAdminMenuOpen(false)}
                                    >
                                        Users
                                    </Link>
                                    <Link 
                                        href="/admin/projects" 
                                        className={`block px-3 py-2 rounded transition-colors ${
                                            isActive('/admin/projects') || pathname.startsWith('/admin/projects/') 
                                                ? 'bg-orange-600/25 border-l-4 border-orange-500' 
                                                : 'hover:bg-orange-600/20 border-l-4 border-transparent'
                                        }`}
                                        onClick={() => setAdminMenuOpen(false)}
                                    >
                                        Projects
                                    </Link>
                                    <Link 
                                        href="/admin/audit-logs" 
                                        className={`block px-3 py-2 rounded transition-colors ${
                                            isActive('/admin/audit-logs') || pathname.startsWith('/admin/audit-logs/') 
                                                ? 'bg-orange-600/25 border-l-4 border-orange-500' 
                                                : 'hover:bg-orange-600/20 border-l-4 border-transparent'
                                        }`}
                                        onClick={() => setAdminMenuOpen(false)}
                                    >
                                        Audit Logs
                                    </Link>
                                    
                                    {isShopOrdersAdmin && (
                                        <Link 
                                            href="/admin/shop-orders" 
                                            className={`block px-3 py-2 rounded transition-colors ${
                                                isActive('/admin/shop-orders') || pathname.startsWith('/admin/shop-orders')
                                                    ? 'bg-orange-600/25 border-l-4 border-orange-500'
                                                    : 'hover:bg-orange-600/20 border-l-4 border-transparent'
                                            }`}
                                            onClick={() => setAdminMenuOpen(false)}
                                        >
                                            Shop Orders
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Mobile menu dropdown */}
                {mobileMenuOpen && (
                    <div className="absolute left-0 top-full mt-2 bg-black text-white rounded-lg shadow-lg p-4 w-48 z-20 md:hidden border border-white/10">
                        <div className="space-y-4">
                            <Link 
                                href="/launchpad" 
                                className={`block transition-colors ${isActive('/launchpad') ? 'font-semibold text-orange-400' : 'text-white hover:text-orange-400'}`}
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                My Projects
                            </Link>
                            <Link 
                                href="/gallery" 
                                className={`block transition-colors ${isActive('/gallery') ? 'font-semibold text-orange-400' : 'text-white hover:text-orange-400'}`}
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                Gallery
                            </Link>
                            {!isIslandMode && (
                                <>
                                    <Link 
                                        href="/leaderboard" 
                                        className={`block transition-colors ${isActive('/leaderboard') ? 'font-semibold text-orange-400' : 'text-white hover:text-orange-400'}`}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Leaderboard
                                    </Link>
                                    <Link 
                                        href="/launchpad/faq" 
                                        className={`block transition-colors ${isActive('/launchpad/faq') ? 'font-semibold text-orange-400' : 'text-white hover:text-orange-400'}`}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        FAQ
                                    </Link>
                                    <Link 
                                        href="/launchpad/badge" 
                                        className={`block transition-colors ${isActive('/launchpad/badge') ? 'font-semibold text-orange-400' : 'text-white hover:text-orange-400'}`}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Badge
                                    </Link>
                                    <Link 
                                        href="/settings" 
                                        className={`block transition-colors ${isActive('/settings') ? 'font-semibold text-orange-400' : 'text-white hover:text-orange-400'}`}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Settings
                                    </Link>
                                </>
                            )}
                            {/* Eligible users can access Shop in mobile menu */}
                            {!isIslandMode && canAccessShop && (
                                <Link 
                                    href="/launchpad/shop" 
                                    className={`block transition-all duration-300 ${isActive('/launchpad/shop') ? 'font-semibold text-orange-400' : 'text-white hover:text-orange-400'}`}
                                    style={{
                                        background: 'linear-gradient(45deg, #8b5cf6, #3b82f6, #8b5cf6)',
                                        backgroundSize: '200% 200%',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        animation: 'gradientShift 3s ease-in-out infinite, flashGlow 2s ease-in-out infinite',
                                        textShadow: '0 0 10px rgba(139, 92, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)',
                                        filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))'
                                    }}
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    ✨ Shop ✨
                                </Link>
                            )}
                            {/* Experience Toggle for attendees in mobile menu */}
                            {session?.user?.isAttendee && (
                                <div className="pt-2 border-t border-gray-200">
                                    <ExperienceToggle className="w-full justify-center" />
                                </div>
                            )}
                            
                            {/* Admin section with submenu for mobile */}
                            {!isIslandMode && isUserAdmin && (
                                <div className="space-y-2">
                                    <div className="font-semibold text-white">Admin</div>
                                    <Link 
                                        href="/admin" 
                                        className={`block pl-4 transition-colors ${isActive('/admin') ? 'font-semibold text-orange-400' : 'text-white hover:text-orange-400'}`}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Dashboard
                                    </Link>
                                    <Link 
                                        href="/admin/users" 
                                        className={`block pl-4 transition-colors ${isActive('/admin/users') ? 'font-semibold text-orange-400' : 'text-white hover:text-orange-400'}`}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Users
                                    </Link>
                                    <Link 
                                        href="/admin/projects" 
                                        className={`block pl-4 transition-colors ${isActive('/admin/projects') ? 'font-semibold text-orange-400' : 'text-white hover:text-orange-400'}`}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Projects
                                    </Link>
                                    <Link 
                                        href="/admin/audit-logs" 
                                        className={`block pl-4 transition-colors ${isActive('/admin/audit-logs') ? 'font-semibold text-orange-400' : 'text-white hover:text-orange-400'}`}
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Audit Logs
                                    </Link>
                                    {isShopOrdersAdmin && (
                                        <Link 
                                            href="/admin/shop-orders" 
                                            className={`block pl-4 transition-colors ${isActive('/admin/shop-orders') ? 'font-semibold text-orange-400' : 'text-white hover:text-orange-400'}`}
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            Shop Orders
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 relative flex-shrink-0" ref={dropdownRef}>
                {/* Stardust balance - top right, left of rocket/name */}
                {status === 'authenticated' && (
                    <div className="flex items-center text-white/90 text-sm mr-2" title={`${AppConfig.currencyName} available`}>
                        <img 
                            src="/stardust.png" 
                            alt={AppConfig.currencyName} 
                            className="h-6 sm:h-7 md:h-8 w-auto mr-2"
                        />
                        <span className="font-semibold tabular-nums whitespace-nowrap min-w-[10ch] text-lg">{stardust ?? 0}</span>
                    </div>
                )}
                {/* Experience Toggle for attendees only */}
                {status === "authenticated" && session?.user?.isAttendee && (
                    <ExperienceToggle className="hidden sm:inline-flex" />
                )}
                
                {status === "authenticated" && (
                    <>
                        <span className="text-white font-semibold hidden lg:inline text-sm xl:text-base items-center gap-2">
                            <span aria-hidden className="text-2xl leading-none">🚀</span>
                            {session?.user.name ? session?.user?.name : session?.user.email?.slice(0, 13) + "..."}
                        </span>
                        
                        {/* Travel Stipend Piggy Bank */}
                        {travelStipends && travelStipends.totalAmount > 0 && (
                            <div 
                                className="flex items-center bg-white bg-opacity-90 text-[#47D1F6] font-bold px-2 sm:px-3 py-2 rounded-lg shadow hover:bg-opacity-100 transition-all cursor-pointer"
                                title={`Travel Stipend: $${travelStipends.totalAmount}`}
                            >
                                <img src="/piggy.png" alt="Travel Stipend" className="w-5 h-5 mr-1" />
                                <span className="text-sm font-bold">${travelStipends.totalAmount}</span>
                            </div>
                        )}
                        <button
                            onClick={() => setDropdownOpen((prev) => !prev)}
                            className="bg-white text-black font-bold px-3 sm:px-4 py-2 rounded-lg shadow hover:text-red-600 transition text-sm whitespace-nowrap"
                        >
                            Eject
                        </button>
                        {dropdownOpen && (
                            <div className="absolute right-0 top-full mt-2 bg-white text-black rounded-lg shadow-lg p-4 w-40 z-10">
                                <div className="text-center space-y-4">
                                <p className="text-sm text-center text-black">Are you sure you want to log out?</p>
                                    <button
                                        type="submit"
                                        className="bg-white text-red-600 font-bold px-4 py-2 rounded-lg shadow hover:bg-red-50 hover:text-red-700 transition"
                                        onClick={() => signOut()}
                                    >
                                        Log me out!
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
                {status !== "authenticated" && (
                    <Link
                        href="/api/auth/signin"
                        className="bg-white text-[#47D1F6] font-bold px-4 py-2 rounded-lg shadow hover:bg-[#f9e9c7] hover:text-[#3B2715] transition"
                    >
                        Sign In
                    </Link>
                )}
            </div>
        </nav>
    );
}