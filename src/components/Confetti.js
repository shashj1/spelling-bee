import React from 'react';

const COLORS = ['#FF6B35', '#4ECDC4', '#FFE66D', '#A78BFA', '#F472B6', '#34D399'];

export default function Confetti({ active }) {
  if (!active) return null;
  
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8
  }));
  
  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            backgroundColor: p.color,
            width: p.size,
            height: p.size
          }}
        />
      ))}
    </div>
  );
}
