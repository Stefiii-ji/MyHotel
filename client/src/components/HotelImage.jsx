import { useState } from 'react';

export default function HotelImage({ src, alt, className = '' }) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        aria-label="Accommodation photo unavailable"
        className={`grid place-items-center bg-[linear-gradient(145deg,#e8e2d4,#a9b5a0)] text-sm font-medium text-[#52604b] ${className}`}
        role="img"
      >
        No photo available
      </div>
    );
  }

  return (
    <img
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      src={src}
    />
  );
}
