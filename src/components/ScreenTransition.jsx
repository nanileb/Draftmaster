import React, { useRef, useEffect } from 'react';

/**
 * Wraps a screen with a slide-in/slide-back animation.
 * direction: 'forward' = slide from right, 'back' = slide from left
 */
export default function ScreenTransition({ children, direction = 'forward', id }) {
  const cls = direction === 'back' ? 'screen-slide-back' : 'screen-slide-enter';
  return (
    <div key={id} className={cls}>
      {children}
    </div>
  );
}