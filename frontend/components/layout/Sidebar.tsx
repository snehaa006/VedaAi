'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { label: 'Home', href: '/', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
      <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )},
  { label: 'My Groups', href: '/groups', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 13c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 7c1.5 0 4 .8 4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="11.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )},
  { label: 'Assignments', href: '/assignments', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
      <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ), badge: true },
  { label: "AI Teacher's Toolkit", href: '/toolkit', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
      <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="10" y="6" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )},
  { label: 'My Library', href: '/library', icon: (
    <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 4.5v4l2.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
];

export default function Sidebar() {
  const pathname = usePathname();

  const active = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside style={{
      width: 240, minWidth: 240,
      background: '#fff',
      borderRight: '1px solid #E5E7EB',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
      userSelect: 'none',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 0' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(145deg, #FF6B2C 0%, #E8450A 100%)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {/* V logo */}
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <path d="M1 1L9 13L17 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#111827', letterSpacing: '-0.3px' }}>VedaAI</span>
        </Link>
      </div>

      {/* Create Assignment btn */}
      <div style={{ padding: '16px 20px 8px' }}>
        <Link href="/assignments/create" style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%',
            background: '#111827',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            cursor: 'pointer',
            fontSize: 13.5,
            fontWeight: 600,
            letterSpacing: '-0.1px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1F2937')}
          onMouseLeave={e => (e.currentTarget.style.background = '#111827')}
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M6 1.5v9M1.5 6h9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Create Assignment
          </button>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 12px' }}>
        {NAV.map(({ label, href, icon, badge }) => {
          const isActive = active(href);
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 8px',
                borderRadius: 8,
                marginBottom: 1,
                background: isActive ? '#F3F4F6' : 'transparent',
                color: isActive ? '#111827' : '#6B7280',
                fontWeight: isActive ? 600 : 400,
                fontSize: 13.5,
                cursor: 'pointer',
                transition: 'all 0.12s',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ flexShrink: 0 }}>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {badge && isActive && (
                  <span style={{
                    background: '#E8450A',
                    color: '#fff',
                    fontSize: 10.5,
                    fontWeight: 700,
                    borderRadius: 10,
                    padding: '1px 6px',
                    minWidth: 18,
                    textAlign: 'center',
                    lineHeight: '16px',
                  }}>10</span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '12px 20px 20px' }}>
        {/* Settings */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 0',
          color: '#6B7280',
          fontSize: 13.5,
          cursor: 'pointer',
          marginBottom: 12,
        }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M11.54 4.46l-1.41 1.41M4.95 11.54l-1.41 1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Settings
        </div>

        {/* School card */}
        <div style={{
          background: '#F9FAFB',
          border: '1px solid #F3F4F6',
          borderRadius: 10,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 36, height: 36,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 50%, #DC2626 100%)',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>🏛️</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: '#111827', lineHeight: 1.3 }}>
              Delhi Public School
            </div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.3 }}>
              Bokaro Steel City
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
