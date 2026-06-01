'use client';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  rightContent?: React.ReactNode;
}

export default function Header({ title = 'Assignment', showBack = false, rightContent }: HeaderProps) {
  const router = useRouter();

  return (
    <header style={{
      height: 56,
      background: '#fff',
      borderBottom: '1px solid #E5E7EB',
      display: 'flex', alignItems: 'center',
      padding: '0 24px',
      gap: 10,
      position: 'sticky', top: 0, zIndex: 20,
      flexShrink: 0,
    }}>
      {/* Back arrow */}
      <button
        onClick={() => showBack ? router.back() : null}
        style={{
          background: 'none', border: 'none',
          cursor: showBack ? 'pointer' : 'default',
          padding: 4,
          display: 'flex', alignItems: 'center',
          color: '#6B7280',
          borderRadius: 6,
        }}
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 18 18">
          <path d="M11 13L7 9l4-4" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Grid icon + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
          <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="#9CA3AF" strokeWidth="1.4"/>
          <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="#9CA3AF" strokeWidth="1.4"/>
          <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="#9CA3AF" strokeWidth="1.4"/>
          <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="#9CA3AF" strokeWidth="1.4"/>
        </svg>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{title}</span>
      </div>

      {/* Right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {rightContent}

        {/* Bell */}
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          position: 'relative', padding: 4,
          display: 'flex', alignItems: 'center',
        }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6Z" stroke="#6B7280" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M8 15.5a2 2 0 0 0 4 0" stroke="#6B7280" strokeWidth="1.5"/>
          </svg>
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 7, height: 7,
            background: '#E8450A',
            borderRadius: '50%',
            border: '1.5px solid #fff',
          }}/>
        </button>

        {/* User */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer',
        }}>
          <div style={{
            width: 30, height: 30,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: '#fff', fontWeight: 700,
          }}>J</div>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: '#374151' }}>John Doe</span>
          <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
            <path d="M4 6l3 3 3-3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </header>
  );
}
